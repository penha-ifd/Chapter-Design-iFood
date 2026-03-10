import React, { useEffect, useState } from "react";

const RANGES = [
  { min: 90, max: 100, label: "Excelente", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  { min: 70, max: 89, label: "Bom", color: "#65a30d", bg: "rgba(101,163,13,0.08)" },
  { min: 50, max: 69, label: "Atenção", color: "#ca8a04", bg: "rgba(202,138,4,0.08)" },
  { min: 0, max: 49, label: "Crítico", color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
];

function getRange(score: number) {
  return RANGES.find((r) => score >= r.min && score <= r.max) || RANGES[3];
}

interface ScoreGaugeProps {
  score: number;
  animate?: boolean;
}

export function ScoreGauge({ score, animate = true }: ScoreGaugeProps) {
  const [display, setDisplay] = useState(animate ? 0 : score);
  const range = getRange(score);
  const C = 339.29;
  const offset = C - (display / 100) * C;

  useEffect(() => {
    if (!animate) { setDisplay(score); return; }
    let current = 0;
    const step = Math.max(1, Math.ceil(score / 40));
    const id = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplay(current);
      if (current >= score) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [score, animate]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 130 130" className="w-[130px] h-[130px]">
          <circle
            cx="65" cy="65" r="54"
            fill="none" stroke="currentColor"
            className="text-muted/60"
            strokeWidth="8"
          />
          <circle
            cx="65" cy="65" r="54"
            fill="none"
            stroke={range.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90,65,65)"
            className="transition-all duration-700 ease-out"
          />
          <text
            x="65" y="57"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[32px] font-extrabold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {display}
          </text>
          <text
            x="65" y="80"
            textAnchor="middle"
            fill={range.color}
            className="text-[11px] font-bold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {range.label}
          </text>
        </svg>
      </div>
    </div>
  );
}

export { getRange };
