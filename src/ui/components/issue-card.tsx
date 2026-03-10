import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RiCheckLine,
  RiSkipForwardLine,
  RiCrosshair2Line,
} from "@remixicon/react";

const CAT_LABELS: Record<string, string> = { component: "Componentes", color: "Cores", typography: "Tipografia", spacing: "Espaçamento" };
const SEV_LABELS: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Média", low: "Baixa" };
const SEV_CLASSES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-warning/10 text-warning",
  low: "bg-info/10 text-info",
};
const SEV_ACCENT: Record<string, string> = {
  critical: "border-l-destructive",
  high: "border-l-warning",
  medium: "border-l-warning",
  low: "border-l-info",
};

interface Issue {
  id: string;
  nodeId: string;
  nodeName: string;
  nodePath: string[];
  issueType: string;
  category: string;
  severity: string;
  description: string;
  currentValue: string;
  expectedValue: string;
  fixData?: { type: string };
  status: string;
}

interface IssueCardProps {
  issue: Issue;
  onFix: (id: string) => void;
  onSkip: (id: string) => void;
  onNavigate: (nodeId: string) => void;
}

const A11Y_ISSUE_TYPES = new Set([
  'contrast-text', 'contrast-ui', 'touch-target-small', 'missing-variant-state',
  'font-size-too-small', 'line-height-invalid', 'hierarchy-break',
  'grid-misaligned', 'rhythm-inconsistent', 'padding-insufficient',
]);

export function IssueCard({ issue, onFix, onSkip, onNavigate }: IssueCardProps) {
  const isResolved = issue.status !== "pending";
  const canFix = issue.fixData && issue.fixData.type !== "manual" && !isResolved;
  const isColor = issue.issueType.includes("fill") || issue.issueType.includes("stroke");
  const isA11y = A11Y_ISSUE_TYPES.has(issue.issueType);
  const hexMatch = issue.expectedValue?.match(/#[0-9A-Fa-f]{6}/);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 border-l-[3px] transition-all",
        "hover:border-l-[3px]",
        SEV_ACCENT[issue.severity] || "border-l-border",
        isResolved && "opacity-40"
      )}
    >
      <p className="text-[10px] text-muted-foreground/70 truncate mb-1.5 font-mono">
        {issue.nodePath?.join(" › ")}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className="text-[10px] font-medium">
          {CAT_LABELS[issue.category]}
        </Badge>
        <Badge variant="secondary" className={cn("text-[10px] font-semibold", SEV_CLASSES[issue.severity])}>
          {SEV_LABELS[issue.severity]}
        </Badge>
        {isA11y && (
          <Badge variant="outline" className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20">
            A11y
          </Badge>
        )}
        {issue.status === "fixed" && (
          <Badge variant="secondary" className="ml-auto bg-success/10 text-success text-[10px] font-semibold">
            Corrigido
          </Badge>
        )}
        {issue.status === "skipped" && (
          <Badge variant="secondary" className="ml-auto bg-warning/10 text-warning text-[10px] font-semibold">
            Pulado
          </Badge>
        )}
      </div>

      <p className="text-[12px] font-semibold mb-0.5 break-words leading-snug">{issue.nodeName}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">{issue.description}</p>

      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted/50">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/8 text-destructive text-[10px] font-mono line-through">
          {isColor && (
            <span className="inline-block w-2.5 h-2.5 rounded-sm border border-black/10 shrink-0" style={{ background: issue.currentValue }} />
          )}
          {issue.currentValue}
        </span>
        <span className="text-muted-foreground text-[11px]">→</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/8 text-success text-[10px] font-mono">
          {isColor && hexMatch && (
            <span className="inline-block w-2.5 h-2.5 rounded-sm border border-black/10 shrink-0" style={{ background: hexMatch[0] }} />
          )}
          {issue.expectedValue}
        </span>
      </div>

      {!isResolved && (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className={cn(
              "flex-1 text-[11px] h-8",
              canFix
                ? "bg-success hover:bg-success/90 text-success-foreground"
                : "bg-muted text-muted-foreground"
            )}
            disabled={!canFix}
            onClick={() => onFix(issue.id)}
          >
            <RiCheckLine className="size-3" />
            Corrigir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-[11px] h-8"
            onClick={() => onSkip(issue.id)}
          >
            <RiSkipForwardLine className="size-3" />
            Pular
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-8 px-2.5"
            onClick={() => onNavigate(issue.nodeId)}
          >
            <RiCrosshair2Line className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
