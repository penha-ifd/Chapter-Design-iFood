import React, { useState, useEffect, useCallback, useRef } from "react";
import { HomeScreen } from "./screens/home";
import { ScanningScreen } from "./screens/scanning";
import { ResultsScreen } from "./screens/results";
import { ReviewScreen } from "./screens/review";

const TRACKING_URL = 'https://script.google.com/macros/s/AKfycbwp6jNZgq23dpdEqNAP99IW59fA9OWj6UhEDIKsaglYdJtjAv9dpyiWNeG1ym2CBFVe/exec';

const DS_COMPONENTS_KEY = "YuYore4hgyjGuWHDtSeLrhxP";
// iFDL — Tokens iFood: https://www.figma.com/design/C57ly4RQ9XcLeiSIA6nlVj/iFDL-%E2%80%94-Tokens-iFood?m=dev
const DS_TOKENS_KEY = "C57ly4RQ9XcLeiSIA6nlVj";
const API = "https://api.figma.com/v1";
const TOKEN = ""; // Insira seu Figma Personal Access Token aqui (não commitar)
const SPACING = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120, 160];

type Screen = "home" | "scanning" | "results" | "review";

function hex(r: number, g: number, b: number) {
  const h = (v: number) => { const s = Math.round(v * 255).toString(16); return s.length < 2 ? "0" + s : s; };
  return "#" + h(r) + h(g) + h(b);
}

function post(msg: any) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryData, setLibraryData] = useState<any>(null);
  const [scope, setScope] = useState<"selection" | "page">("selection");
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const autoConnected = useRef(false);

  const apiFetch = useCallback((endpoint: string) => {
    return fetch(API + endpoint, { headers: { "X-Figma-Token": TOKEN } }).then((r) => {
      if (!r.ok) {
        if (r.status === 403) throw new Error("Token inválido ou sem permissão");
        if (r.status === 404) throw new Error("Arquivo não encontrado");
        throw new Error("Erro " + r.status);
      }
      return r.json();
    });
  }, []);

  const fetchStylesFromFile = useCallback(async (fileKey: string) => {
    const styleData = await apiFetch("/files/" + fileKey + "/styles");
    const styles = styleData.meta?.styles || [];
    const smap: Record<string, any> = {};
    const sids: string[] = [];
    styles.forEach((s: any) => { if (s.node_id) { sids.push(s.node_id); smap[s.node_id] = s; } });

    let nodesData: Record<string, any> = {};
    if (sids.length > 0) {
      for (let i = 0; i < sids.length; i += 50) {
        const batch = sids.slice(i, i + 50);
        const res = await apiFetch("/files/" + fileKey + "/nodes?ids=" + encodeURIComponent(batch.join(",")));
        if (res.nodes) Object.assign(nodesData, res.nodes);
      }
    }

    const colors: any[] = [];
    const texts: any[] = [];
    Object.keys(nodesData).forEach((nid) => {
      const ni = nodesData[nid];
      const sm = smap[nid];
      if (!ni?.document || !sm) return;
      const doc = ni.document;
      // Figma REST API: style key (para importStyleByKeyAsync) pode vir como "key"; node_id é o id do nó
      const styleKey = String(sm.key ?? (sm as any).key ?? sm.node_id ?? "").trim();
      if (sm.style_type === "FILL") {
        (doc.fills || []).forEach((f: any) => {
          if (f.type === "SOLID" && f.color && styleKey) {
            colors.push({ name: sm.name, hex: hex(f.color.r, f.color.g, f.color.b).toUpperCase(), r: f.color.r, g: f.color.g, b: f.color.b, styleId: styleKey });
          }
        });
      }
      if (sm.style_type === "TEXT") {
        if (styleKey) {
          const st = doc.style || {};
          texts.push({ name: sm.name, fontFamily: st.fontFamily || "", fontWeight: String(st.fontWeight || "Regular"), fontSize: st.fontSize || 16, lineHeight: st.lineHeightPx || null, letterSpacing: st.letterSpacing || 0, styleId: styleKey });
        }
      }
    });

    return { colors, texts };
  }, [apiFetch]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectError("");

    try {
      const [compData, componentsStyles, tokensStyles] = await Promise.all([
        apiFetch("/files/" + DS_COMPONENTS_KEY + "/components"),
        fetchStylesFromFile(DS_COMPONENTS_KEY),
        fetchStylesFromFile(DS_TOKENS_KEY),
      ]);

      const comps = (compData.meta?.components || []).map((c: any) => ({
        key: c.key || "", name: c.name || "", description: c.description || "",
        remote: true, componentSetName: c.name?.includes("/") ? c.name.split("/")[0] : undefined,
      }));

      const dedupColors = new Map<string, any>();
      tokensStyles.colors.forEach((c: any) => dedupColors.set(c.hex + "|" + c.name, c));
      componentsStyles.colors.forEach((c: any) => {
        const key = c.hex + "|" + c.name;
        if (!dedupColors.has(key)) dedupColors.set(key, c);
      });
      const colors = Array.from(dedupColors.values());

      const dedupTexts = new Map<string, any>();
      tokensStyles.texts.forEach((t: any) => dedupTexts.set(t.name, t));
      componentsStyles.texts.forEach((t: any) => {
        if (!dedupTexts.has(t.name)) dedupTexts.set(t.name, t);
      });
      const texts = Array.from(dedupTexts.values());

      const cn = comps.map((c: any) => c.name);
      comps.forEach((c: any) => { if (c.componentSetName) cn.push(c.componentSetName); });

      const idx = { components: comps, componentNames: cn, colorTokens: colors, textStyles: texts, spacingScale: SPACING.slice(), lastBuilt: Date.now(), fromApi: true };
      post({ type: "save-token", token: TOKEN });
      post({ type: "set-library-index", index: idx });
    } catch (e: any) {
      setConnectError(e.message || "Erro de conexão");
      setConnecting(false);
    }
  }, [apiFetch, fetchStylesFromFile]);

  useEffect(() => {
    if (!autoConnected.current) {
      autoConnected.current = true;
      handleConnect();
    }
  }, [handleConnect]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      console.log('[Tomate msg]', msg.type);

      switch (msg.type) {
        case "token-loaded":
          break;
        case "library-status":
          setConnecting(false);
          if (msg.loaded && (msg.componentCount > 0 || msg.colorCount > 0)) {
            setLibraryLoaded(true);
            setLibraryData(msg);
          }
          break;
        case "scan-progress":
          setScanProgress(msg.progress);
          break;
        case "scan-complete":
          setResult(msg.result);
          setScreen("results");
          break;
        case "score-updated":
          setResult(msg.result);
          break;
        case "fix-all-complete":
          setResult(msg.result);
          setFixingAll(false);
          break;
        case "track-usage":
          if (TRACKING_URL && msg.payload) {
            const p = msg.payload;
            const qs = new URLSearchParams({
              userName: p.userName || '',
              userId: p.userId || '',
              fileName: p.fileName || '',
              scope: p.scope || '',
              score: String(p.score || 0),
              totalIssues: String(p.totalIssues || 0),
              component: String(p.component || 0),
              color: String(p.color || 0),
              typography: String(p.typography || 0),
              spacing: String(p.spacing || 0),
              nodesScanned: String(p.nodesScanned || 0),
              durationSec: String(p.durationSec || 0),
            });
            const trackUrl = TRACKING_URL + '?' + qs.toString();
            // mode: 'no-cors' necessário pois o iframe do Figma tem origin: null
            fetch(trackUrl, { method: 'GET', mode: 'no-cors' })
              .then(() => console.log('[Tomate tracking] enviado'))
              .catch(err => console.error('[Tomate tracking] erro:', err));
          }
          break;
        case "issue-fixed":
        case "issue-skipped":
          break;
        case "error":
          if (screen === "scanning") setScreen("home");
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [screen]);

  return (
    <>
      {screen === "home" && (
        <HomeScreen
          libraryLoaded={libraryLoaded}
          libraryData={libraryData}
          connecting={connecting}
          connectError={connectError}
          onRetryConnect={handleConnect}
          scope={scope}
          onScopeChange={setScope}
          onScan={() => { setScreen("scanning"); setScanProgress(0); post({ type: "start-scan", scope }); }}
        />
      )}
      {screen === "scanning" && (
        <ScanningScreen progress={scanProgress} />
      )}
      {screen === "results" && (
        <ResultsScreen
          result={result}
          onNewScan={() => { setResult(null); setScreen("home"); }}
          onReview={() => setScreen("review")}
          onFixAll={() => { setFixingAll(true); post({ type: "fix-all-issues" }); }}
          fixingAll={fixingAll}
        />
      )}
      {screen === "review" && (
        <ReviewScreen
          result={result}
          onBack={() => setScreen("results")}
          onFix={(id) => post({ type: "fix-issue", issueId: id })}
          onFixAll={() => post({ type: "fix-all-issues" })}
          onSkip={(id) => post({ type: "skip-issue", issueId: id })}
          onNavigate={(nodeId) => post({ type: "navigate-to-node", nodeId })}
        />
      )}
    </>
  );
}
