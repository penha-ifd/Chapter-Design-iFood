import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RiRefreshLine,
  RiScanLine,
  RiStackLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiErrorWarningLine,
} from "@remixicon/react";
import tomateLogo from "../tomate-logo.png";

interface HomeProps {
  libraryLoaded: boolean;
  libraryData: { componentCount: number; colorCount: number; textStyleCount: number } | null;
  connecting: boolean;
  connectError: string;
  onRetryConnect: () => void;
  scope: "selection" | "page";
  onScopeChange: (s: "selection" | "page") => void;
  onScan: () => void;
}

export function HomeScreen({
  libraryLoaded, libraryData, connecting, connectError,
  onRetryConnect, scope, onScopeChange, onScan,
}: HomeProps) {
  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen">
      <div className="text-center pt-6 pb-2">
        <img src={tomateLogo} alt="Tomate" className="w-16 h-16 mx-auto mb-3" />
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">
          Tomate <span className="text-primary">IFDS</span>
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">Design System Audit Tool</p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                libraryLoaded
                  ? "bg-success/10"
                  : connecting
                    ? "bg-primary/10"
                    : connectError
                      ? "bg-destructive/10"
                      : "bg-muted"
              )}>
                {libraryLoaded ? (
                  <RiCheckboxCircleLine className="size-4 text-success" />
                ) : connecting ? (
                  <RiLoader4Line className="size-4 text-primary animate-spin" />
                ) : connectError ? (
                  <RiErrorWarningLine className="size-4 text-destructive" />
                ) : (
                  <RiLoader4Line className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {libraryLoaded
                    ? "iFDS — Web + Tokens"
                    : connecting
                      ? "Conectando…"
                      : connectError
                        ? "Erro na conexão"
                        : "Aguardando…"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {libraryLoaded && libraryData
                    ? `${libraryData.componentCount} componentes · ${libraryData.colorCount} cores · ${libraryData.textStyleCount} estilos`
                    : connecting
                      ? "Buscando componentes e tokens de 2 arquivos"
                      : connectError
                        ? connectError
                        : "Carregando biblioteca"}
                </p>
              </div>
              {connectError && !connecting && (
                <Button variant="outline" size="sm" onClick={onRetryConnect} className="shrink-0">
                  <RiRefreshLine className="size-3.5" />
                  Tentar
                </Button>
              )}
            </div>
          </div>
          {libraryLoaded && libraryData && (
            <div className="grid grid-cols-3 border-t border-border">
              {[
                { n: libraryData.componentCount, l: "Componentes" },
                { n: libraryData.colorCount, l: "Cores" },
                { n: libraryData.textStyleCount, l: "Estilos" },
              ].map((stat) => (
                <div key={stat.l} className="flex flex-col items-center py-2.5 first:border-r last:border-l border-border">
                  <span className="text-sm font-bold text-foreground">{stat.n}</span>
                  <span className="text-[10px] text-muted-foreground">{stat.l}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Escopo da análise
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "selection" as const, Icon: RiScanLine, label: "Seleção", desc: "Frame selecionado" },
            { id: "page" as const, Icon: RiStackLine, label: "Página", desc: "Página inteira" },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => onScopeChange(opt.id)}
              className={cn(
                "group flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer",
                scope === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                scope === opt.id ? "bg-primary/10" : "bg-muted group-hover:bg-muted-foreground/10"
              )}>
                <opt.Icon className={cn("size-[18px]", scope === opt.id ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-xs font-semibold", scope === opt.id && "text-primary")}>{opt.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-3">
        <Button
          className="w-full h-11 text-sm font-semibold"
          disabled={!libraryLoaded}
          onClick={onScan}
        >
          Iniciar Scan
        </Button>
      </div>
    </div>
  );
}
