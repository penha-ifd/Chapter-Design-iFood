import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IssueCard } from "@/components/issue-card";
import { getRange } from "@/components/score-gauge";
import { cn } from "@/lib/utils";
import { RiArrowLeftLine } from "@remixicon/react";

const A11Y_ISSUE_TYPES = [
  'contrast-text', 'contrast-ui', 'touch-target-small', 'missing-variant-state',
  'font-size-too-small', 'line-height-invalid', 'hierarchy-break',
  'grid-misaligned', 'rhythm-inconsistent', 'padding-insufficient',
];

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "component", label: "Componentes" },
  { id: "color", label: "Cores" },
  { id: "typography", label: "Tipografia" },
  { id: "spacing", label: "Espaçamento" },
];

interface ReviewProps {
  result: any;
  onBack: () => void;
  onFix: (id: string) => void;
  onFixAll: () => void;
  onSkip: (id: string) => void;
  onNavigate: (nodeId: string) => void;
}

export function ReviewScreen({ result, onBack, onFix, onFixAll, onSkip, onNavigate }: ReviewProps) {
  const [filter, setFilter] = useState("all");
  const [fixingAll, setFixingAll] = useState(false);

  if (!result) return null;

  const range = getRange(result.totalScore);
  // A11y issues estão desabilitados — excluir de todas as views
  let issues = result.issues.filter((i: any) => !A11Y_ISSUE_TYPES.includes(i.issueType));
  if (filter !== "all") {
    issues = issues.filter((i: any) => i.category === filter);
  }

  const pending = issues.filter((i: any) => i.status === "pending");
  const fixableCount = issues.filter(
    (i: any) => i.status === "pending" && i.fixData && i.fixData.type !== "manual"
  ).length;
  const resolved = issues.filter((i: any) => i.status !== "pending");
  const sorted = [...pending, ...resolved];

  useEffect(() => {
    setFixingAll(false);
  }, [result]);

  const handleFixAll = () => {
    setFixingAll(true);
    onFixAll();
  };

  return (
    <div className="flex flex-col gap-3 p-4 min-h-screen">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <RiArrowLeftLine className="size-3.5" />
          Voltar
        </Button>
        <div className="flex-1 text-center">
          <Badge variant="secondary" className="text-[11px] font-semibold">
            {pending.length} pendente{pending.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: range.color }} />
          <span className="text-sm font-extrabold" style={{ color: range.color }}>
            {result.totalScore}
          </span>
        </div>
      </div>

      {fixableCount > 0 && (
        <Button
          className="w-full font-semibold"
          onClick={handleFixAll}
          disabled={fixingAll}
        >
          {fixingAll ? "Corrigindo…" : `Corrigir todas (${fixableCount})`}
        </Button>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-2">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success/10 mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhuma issue encontrada!</p>
            <p className="text-[11px] text-muted-foreground mt-1">Tudo conforme nesta categoria</p>
          </div>
        ) : (
          sorted.map((issue: any) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onFix={onFix}
              onSkip={onSkip}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
