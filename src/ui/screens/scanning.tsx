import React from "react";
import { Progress } from "@/components/ui/progress";
import tomateLogo from "../tomate-logo.png";

interface ScanningProps {
  progress: number;
}

export function ScanningScreen({ progress }: ScanningProps) {
  const done = progress >= 100;

  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 p-6 min-h-screen">
      <div className="relative flex items-center justify-center w-20 h-20">
        {!done && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-sonar" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-sonar [animation-delay:0.5s]" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-sonar [animation-delay:1s]" />
          </>
        )}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
          <img src={tomateLogo} alt="Tomate" className={`w-10 h-10 transition-transform ${done ? "scale-110" : ""}`} />
        </div>
      </div>

      <p className="text-sm font-bold text-foreground">
        {done ? "Análise completa!" : "Analisando layout…"}
      </p>

      <div className="w-full max-w-[220px] space-y-2.5">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Progresso</span>
          <span className="text-xs font-bold text-primary">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
