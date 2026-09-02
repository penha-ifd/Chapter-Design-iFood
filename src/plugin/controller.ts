import type { AuditResult, PluginMessage, FixData, SerializedLibraryIndex } from '../shared/types';
import { PLUGIN_UI_WIDTH, PLUGIN_UI_HEIGHT, CACHE_KEY_TOKEN } from '../shared/constants';
import { LibraryParser } from './library-parser';
import { AuditEngine } from './audit-engine';
import { trackScanUsage } from './usage-tracker';

const libraryParser = new LibraryParser();
let currentResult: AuditResult | null = null;

// Captura o usuário de forma síncrona no início do plugin,
// antes de qualquer await (único momento garantido de ter o valor)
const currentUser = {
  name: figma.currentUser?.name || '',
  id: figma.currentUser?.id || '',
};

figma.showUI(__html__, {
  width: PLUGIN_UI_WIDTH,
  height: PLUGIN_UI_HEIGHT,
  themeColors: true,
  title: 'Tomate — DS Audit',
});

async function initPlugin(): Promise<void> {
  const token = await figma.clientStorage.getAsync(CACHE_KEY_TOKEN) as string | undefined;
  figma.ui.postMessage({ type: 'token-loaded', token: token || null });

  await loadLibrary(false);
}

async function loadLibrary(forceRebuild = false): Promise<void> {
  try {
    const index = await libraryParser.loadIndex(forceRebuild);
    const canApplyTokens = index.fromApi === true;
    figma.ui.postMessage({
      type: 'library-status',
      loaded: canApplyTokens,
      componentCount: index.components.length,
      colorCount: index.colorTokens.length,
      textStyleCount: index.textStyles.length,
    });
  } catch (err) {
    figma.ui.postMessage({
      type: 'library-status',
      loaded: false,
      componentCount: 0,
      colorCount: 0,
      textStyleCount: 0,
    });
  }
}

async function saveToken(token: string): Promise<void> {
  await figma.clientStorage.setAsync(CACHE_KEY_TOKEN, token);
}

async function setLibraryIndex(serialized: SerializedLibraryIndex): Promise<void> {
  try {
    const index = libraryParser.setExternalIndex(serialized);
    figma.ui.postMessage({
      type: 'library-status',
      loaded: true,
      componentCount: index.components.length,
      colorCount: index.colorTokens.length,
      textStyleCount: index.textStyles.length,
    });
    figma.notify('🍅 Biblioteca iFDS carregada: ' + index.components.length + ' componentes, ' + index.colorTokens.length + ' cores, ' + index.textStyles.length + ' text styles');
  } catch (err) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Erro ao processar índice da biblioteca: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
}

async function startScan(scope: 'selection' | 'page'): Promise<void> {
  const index = libraryParser.getIndex();
  if (!index) {
    figma.ui.postMessage({ type: 'error', message: 'Biblioteca não carregada. Conecte à biblioteca iFDS primeiro.' });
    return;
  }
  if (index.fromApi !== true) {
    figma.ui.postMessage({ type: 'error', message: 'Aguarde a conexão com iFDS (tokens da API). Necessário para corrigir inconsistências.' });
    return;
  }

  let nodes: readonly SceneNode[];
  let scopeLabel: string;

  if (scope === 'selection') {
    nodes = figma.currentPage.selection;
    if (nodes.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Nenhum elemento selecionado. Selecione um frame ou elementos no canvas.' });
      return;
    }
    scopeLabel = nodes.length === 1 ? nodes[0].name : nodes.length + ' elementos selecionados';
  } else {
    nodes = figma.currentPage.children;
    scopeLabel = figma.currentPage.name;
  }

  const engine = new AuditEngine(index, function(progress, message) {
    figma.ui.postMessage({ type: 'scan-progress', progress: progress, message: message });
  });

  try {
    currentResult = await engine.scan(nodes, scopeLabel);
    figma.ui.postMessage({ type: 'scan-complete', result: currentResult });

    const scoreLabel = currentResult.totalScore >= 90 ? 'Excelente' :
      currentResult.totalScore >= 70 ? 'Bom' :
      currentResult.totalScore >= 50 ? 'Atenção' : 'Crítico';

    figma.notify('🍅 Tomate: Score ' + currentResult.totalScore + '/100 (' + scoreLabel + ') — ' + currentResult.issues.length + ' issues encontradas');

    // Envia dados de uso para Google Sheets (fire-and-forget)
    trackScanUsage(currentResult, currentUser);
  } catch (err) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Erro durante o scan: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
}

async function fixIssue(issueId: string): Promise<void> {
  if (!currentResult) return;

  const issue = currentResult.issues.find(function(i) { return i.id === issueId; });
  if (!issue || !issue.fixData) {
    figma.ui.postMessage({ type: 'issue-fixed', issueId: issueId, success: false });
    return;
  }

  try {
    const success = await applyFix(issue.fixData);
    if (success) {
      issue.status = 'fixed';
      currentResult = AuditEngine.recalculateScore(currentResult);
      figma.ui.postMessage({ type: 'issue-fixed', issueId: issueId, success: true });
      figma.ui.postMessage({ type: 'score-updated', result: currentResult });
    } else {
      figma.ui.postMessage({ type: 'issue-fixed', issueId: issueId, success: false });
    }
  } catch (_) {
    figma.ui.postMessage({ type: 'issue-fixed', issueId: issueId, success: false });
  }
}

async function applyFix(fixData: FixData, options?: { silent?: boolean }): Promise<boolean> {
  let node: BaseNode | null = null;
  try {
    if (typeof (figma as any).getNodeByIdAsync === 'function') {
      node = await (figma as any).getNodeByIdAsync(fixData.nodeId);
    } else {
      node = figma.getNodeById(fixData.nodeId);
    }
  } catch (_) {
    return false;
  }
  if (!node || !('visible' in node)) return false;

  const notifyOnFail = options?.silent !== true;

  switch (fixData.type) {
    case 'apply-fill': {
      const target = node as SceneNode;
      if (!('fills' in target)) return false;
      const fills = (target as any).fills;
      if (!fills || typeof fills === 'symbol' || !Array.isArray(fills)) return false;
      const newColor = { r: fixData.color.r, g: fixData.color.g, b: fixData.color.b };
      const newFills = fills.map(function(paint: Paint) {
        if (paint.type === 'SOLID') {
          return { type: paint.type, color: newColor, opacity: paint.opacity, visible: paint.visible, blendMode: paint.blendMode };
        }
        return paint;
      });
      (target as any).fills = newFills;
      return true;
    }

    case 'apply-fill-style': {
      const target = node as SceneNode;
      if (!('fills' in target) || !fixData.styleKey) return false;
      try {
        if (typeof (figma as any).importStyleByKeyAsync === 'function') {
          const style = await (figma as any).importStyleByKeyAsync(fixData.styleKey);
          if (style && style.type === 'PAINT') {
            await (target as any).setFillStyleIdAsync(style.id);
            return true;
          }
        }
      } catch (err: unknown) {
        if (notifyOnFail) {
          const msg = err instanceof Error ? err.message : String(err);
          figma.notify('Token de cor: ' + (msg.indexOf('Unable') >= 0 ? 'biblioteca iFDL Tokens precisa estar vinculada e publicada (publique no arquivo da lib).' : msg), { error: true });
        }
      }
      return false;
    }

    case 'apply-stroke': {
      const target = node as SceneNode;
      if (!('strokes' in target)) return false;
      const strokes = (target as any).strokes;
      if (!strokes || typeof strokes === 'symbol' || !Array.isArray(strokes)) return false;
      const newColor = { r: fixData.color.r, g: fixData.color.g, b: fixData.color.b };
      const newStrokes = strokes.map(function(paint: Paint) {
        if (paint.type === 'SOLID') {
          return { type: paint.type, color: newColor, opacity: paint.opacity, visible: paint.visible, blendMode: paint.blendMode };
        }
        return paint;
      });
      (target as any).strokes = newStrokes;
      return true;
    }

    case 'apply-stroke-style': {
      const target = node as SceneNode;
      if (!('strokes' in target) || !fixData.styleKey) return false;
      try {
        if (typeof (figma as any).importStyleByKeyAsync === 'function') {
          const style = await (figma as any).importStyleByKeyAsync(fixData.styleKey);
          if (style && style.type === 'PAINT') {
            await (target as any).setStrokeStyleIdAsync(style.id);
            return true;
          }
        }
      } catch (err: unknown) {
        if (notifyOnFail) {
          const msg = err instanceof Error ? err.message : String(err);
          figma.notify('Token de contorno: ' + (msg.indexOf('Unable') >= 0 ? 'biblioteca iFDL Tokens precisa estar vinculada e publicada (publique no arquivo da lib).' : msg), { error: true });
        }
      }
      return false;
    }

    case 'apply-text-style': {
      const target = node as SceneNode;
      if (target.type !== 'TEXT' || !fixData.styleKey) return false;
      try {
        // Load all fonts used by the text node before modifying style
        const textNode = target as TextNode;
        const fontNames = textNode.getRangeAllFontNames(0, textNode.characters.length);
        for (const font of fontNames) {
          await figma.loadFontAsync(font);
        }
        if (typeof (figma as any).importStyleByKeyAsync === 'function') {
          const style = await (figma as any).importStyleByKeyAsync(fixData.styleKey);
          if (style && style.type === 'TEXT') {
            await (textNode as any).setTextStyleIdAsync(style.id);
            return true;
          }
        }
      } catch (err: unknown) {
        if (notifyOnFail) {
          const msg = err instanceof Error ? err.message : String(err);
          figma.notify('Token de tipografia: ' + (msg.indexOf('Unable') >= 0 ? 'biblioteca iFDL Tokens precisa estar vinculada e publicada (publique no arquivo da lib).' : msg), { error: true });
        }
      }
      return false;
    }

    case 'apply-spacing': {
      const frame = node as FrameNode;
      if (frame.layoutMode === 'NONE') return false;
      try {
        const targetValue = fixData.value;
        let applied = false;

        // Tenta vincular via variável de espaçamento da biblioteca (token)
        if (typeof (figma as any).variables?.getLocalVariablesAsync === 'function') {
          const vars: Variable[] = await (figma as any).variables.getLocalVariablesAsync('FLOAT');
          // Procura variável com o valor correto cujo nome contém 'scale', 'spacing' ou 'space'
          const match = vars.find((v: Variable) => {
            const name = v.name.toLowerCase();
            const valueMatches = Object.values(v.valuesByMode).some(
              (val: unknown) => typeof val === 'number' && val === targetValue
            );
            return valueMatches && (
              name.includes('scale') || name.includes('spacing') || name.includes('space')
            );
          });

          if (match && typeof (frame as any).setBoundVariableForField === 'function') {
            try {
              await (frame as any).setBoundVariableForField(fixData.property, match);
              applied = true;
            } catch (_) { /* fallback para valor absoluto */ }
          }
        }

        // Fallback: aplica valor numérico absoluto se não encontrou variável
        if (!applied) {
          (frame as any)[fixData.property] = fixData.value;
        }
        return true;
      } catch (_) {
        try { (frame as any)[fixData.property] = fixData.value; return true; } catch (_2) { return false; }
      }
    }

    case 'apply-line-height': {
      const target = node as SceneNode;
      if (target.type !== 'TEXT') return false;
      try {
        const textNode = target as TextNode;
        const fontNames = textNode.getRangeAllFontNames(0, textNode.characters.length);
        for (const font of fontNames) {
          await figma.loadFontAsync(font);
        }
        (target as any).lineHeight = { unit: 'PIXELS', value: fixData.value };
        return true;
      } catch (_) {
        return false;
      }
    }

    case 'fix-alignment': {
      const target = node as SceneNode;
      if (!('x' in target) || !('y' in target)) return false;
      try {
        (target as any).x = fixData.x;
        (target as any).y = fixData.y;
        return true;
      } catch (_) {
        return false;
      }
    }

    case 'manual':
      return false;

    default:
      return false;
  }
}

async function fixAllIssues(): Promise<void> {
  if (!currentResult) return;

  const toFix = currentResult.issues.filter(function(i) {
    return i.status === 'pending' && i.fixData && i.fixData.type !== 'manual';
  });

  let fixedCount = 0;
  for (const issue of toFix) {
    if (!issue.fixData) continue;
    try {
      const success = await applyFix(issue.fixData, { silent: true });
      if (success) {
        issue.status = 'fixed';
        fixedCount++;
      }
    } catch (_) {
      // continue with next
    }
  }

  if (fixedCount > 0) {
    currentResult = AuditEngine.recalculateScore(currentResult);
    figma.ui.postMessage({ type: 'score-updated', result: currentResult });
    figma.ui.postMessage({ type: 'fix-all-complete', result: currentResult, fixedCount });
    figma.notify('🍅 ' + fixedCount + ' inconsistência(s) corrigida(s) com os tokens do DS.');
  } else {
    if (toFix.length > 0) {
      figma.notify('Nenhuma correção aplicada. Vincule a biblioteca iFDL Tokens ao arquivo (Resources).', { error: true });
    }
    figma.ui.postMessage({ type: 'fix-all-complete', result: currentResult, fixedCount: 0 });
  }
}

function skipIssue(issueId: string): void {
  if (!currentResult) return;

  const issue = currentResult.issues.find(function(i) { return i.id === issueId; });
  if (!issue) return;

  issue.status = 'skipped';
  currentResult = AuditEngine.recalculateScore(currentResult);
  figma.ui.postMessage({ type: 'issue-skipped', issueId: issueId });
  figma.ui.postMessage({ type: 'score-updated', result: currentResult });
}

async function navigateToNode(nodeId: string): Promise<void> {
  let node: BaseNode | null = null;

  try {
    if (typeof (figma as any).getNodeByIdAsync === 'function') {
      node = await (figma as any).getNodeByIdAsync(nodeId);
    } else {
      node = figma.getNodeById(nodeId);
    }
  } catch (_) {
    figma.ui.postMessage({ type: 'error', message: 'Não foi possível encontrar o elemento.' });
    return;
  }

  if (node && 'visible' in node) {
    const sceneNode = node as SceneNode;
    figma.currentPage.selection = [sceneNode];
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
  } else {
    figma.ui.postMessage({ type: 'error', message: 'Elemento não encontrado no canvas atual.' });
  }
}

figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case 'load-library':
      await loadLibrary(true);
      break;
    case 'save-token':
      await saveToken(msg.token);
      break;
    case 'set-library-index':
      await setLibraryIndex(msg.index);
      break;
    case 'start-scan':
      await startScan(msg.scope);
      break;
    case 'fix-issue':
      await fixIssue(msg.issueId);
      break;
    case 'fix-all-issues':
      await fixAllIssues();
      break;
    case 'skip-issue':
      skipIssue(msg.issueId);
      break;
    case 'navigate-to-node':
      await navigateToNode(msg.nodeId);
      break;
    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;
  }
};

initPlugin();
