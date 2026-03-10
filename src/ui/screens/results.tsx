import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreGauge, getRange } from "@/components/score-gauge";
import { RiArrowGoBackLine, RiArrowRightLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

const A11Y_ISSUE_TYPES = [
  'contrast-text', 'contrast-ui', 'touch-target-small', 'missing-variant-state',
  'font-size-too-small', 'line-height-invalid', 'hierarchy-break',
  'grid-misaligned', 'rhythm-inconsistent', 'padding-insufficient',
];

const CAT_LABELS: Record<string, string> = { component: "Componentes", color: "Cores", typography: "Tipografia", spacing: "Espaçamento" };
const CAT_WEIGHTS: Record<string, string> = { component: "40%", color: "25%", typography: "20%", spacing: "15%" };
const SEV_LABELS: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Média", low: "Baixa" };
const SEV_CLASSES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

interface ResultsProps {
  result: any;
  onNewScan: () => void;
  onReview: () => void;
  onFixAll: () => void;
  fixingAll?: boolean;
}

export function ResultsScreen({ result, onNewScan, onReview, onFixAll, fixingAll }: ResultsProps) {
  if (!result) return null;

  // Exclui issues A11y de todos os contadores e botões
  const dsIssues = result.issues.filter((i: any) => !A11Y_ISSUE_TYPES.includes(i.issueType));
  const pending = dsIssues.filter((i: any) => i.status === "pending");
  const fixableCount = dsIssues.filter(
    (i: any) => i.status === "pending" && i.fixData && i.fixData.type !== "manual"
  ).length;
  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  pending.forEach((i: any) => { sevCounts[i.severity]++; });

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Resultado</h2>
        <Button variant="ghost" size="sm" onClick={onNewScan} className="text-muted-foreground hover:text-foreground">
          <RiArrowGoBackLine className="size-3.5" />
          Novo scan
        </Button>
      </div>

      <div className="text-center py-2">
        <ScoreGauge score={result.totalScore} />
        <p className="text-[11px] text-muted-foreground mt-2">
          {result.totalNodesScanned} nodes · {(result.scanDurationMs / 1000).toFixed(1)}s · {result.scope}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categorias</p>
          {result.categoryScores.map((cs: any) => {
            const rng = getRange(cs.score);
            return (
              <div key={cs.category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-foreground">
                    {CAT_LABELS[cs.category]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color: rng.color }}>
                      {cs.score}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 w-6 text-right">
                      {CAT_WEIGHTS[cs.category]}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${cs.score}%`, background: rng.color }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className={cn(pending.length > 0 && "border-destructive/20")}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">Issues encontradas</span>
            <Badge variant="destructive" className="text-[11px] font-bold">{pending.length}</Badge>
          </div>

          {pending.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {(["critical", "high", "medium", "low"] as const).map((s) =>
                sevCounts[s] > 0 ? (
                  <Badge key={s} variant="outline" className={cn("text-[10px] font-semibold border", SEV_CLASSES[s])}>
                    {sevCounts[s]} {SEV_LABELS[s]}
                  </Badge>
                ) : null
              )}
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              {fixableCount > 0 && (
                <Button
                  className="w-full h-10 font-semibold"
                  onClick={onFixAll}
                  disabled={fixingAll}
                >
                  {fixingAll ? "Corrigindo…" : `Corrigir todas (${fixableCount})`}
                </Button>
              )}
              <Button
                variant={fixableCount > 0 ? "outline" : "default"}
                className="w-full h-10 font-semibold"
                onClick={onReview}
              >
                Revisar issues
                <RiArrowRightLine className="size-3.5 ml-1" />
              </Button>
            </div>
          )}

          {pending.length === 0 && (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-success">Tudo conforme o Design System!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
