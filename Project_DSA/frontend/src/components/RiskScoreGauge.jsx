import { useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";

import { riskColorClasses } from "../utils/risk.js";

const attentionCopy = {
  High: {
    label: "High attention",
    description: "Several clauses deserve close review before you sign.",
  },
  Medium: {
    label: "Moderate attention",
    description: "Some terms should be clarified before you commit.",
  },
  Low: {
    label: "Low attention",
    description:
      "No major rule-based warning signs were found, but still read the agreement carefully.",
  },
};

export default function RiskScoreGauge({ score, level }) {
  const colors = riskColorClasses(level);
  const targetScore = useMemo(() => Math.max(0, Math.min(Number(score) || 0, 100)), [score]);
  const [animatedScore, setAnimatedScore] = useState(0);
  const copy = attentionCopy[level] || attentionCopy.Low;

  useEffect(() => {
    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldReduceMotion) {
      setAnimatedScore(targetScore);
      return undefined;
    }

    let animationFrame = 0;
    const duration = 1150;
    const startedAt = performance.now();

    function animateScore(currentTime) {
      const elapsed = currentTime - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore(Math.round(targetScore * easedProgress));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateScore);
      }
    }

    setAnimatedScore(0);
    animationFrame = requestAnimationFrame(animateScore);

    return () => cancelAnimationFrame(animationFrame);
  }, [targetScore]);

  const markerPosition = Math.max(2, Math.min(animatedScore, 98));
  const scoreDegrees = animatedScore * 3.6;
  const scoreMidDegrees = scoreDegrees * 0.58;

  return (
    <section
      className="scroll-reveal surface-card risk-score-panel p-7"
      data-scroll-reveal
      style={{
        "--score-degrees": `${scoreDegrees}deg`,
        "--score-mid-degrees": `${scoreMidDegrees}deg`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-base font-bold uppercase text-slate-500">
            <Gauge className="h-5 w-5" aria-hidden="true" />
            Review priority
          </div>
          <div className="mt-3">
            <p className="text-4xl font-bold text-slate-950 sm:text-5xl">{copy.label}</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Signal strength {animatedScore}/100
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="risk-score-dial" aria-hidden="true">
            <div className="risk-score-dial-inner">
              <span className="text-2xl font-bold text-slate-950">{animatedScore}</span>
              <span className="text-xs font-bold uppercase text-slate-500">/100</span>
            </div>
          </div>
          <span className={`rounded-full px-4 py-2 text-base font-bold ${colors.badge}`}>
            {level} priority
          </span>
        </div>
      </div>

      <div
        className="risk-scale mt-7"
        style={{
          "--score-width": `${animatedScore}%`,
          "--marker-position": `${markerPosition}%`,
        }}
      >
        <div className="mb-2 flex justify-between text-xs font-bold uppercase text-slate-500">
          <span>Low attention</span>
          <span>Moderate</span>
          <span>High attention</span>
        </div>
        <div className="risk-scale-track">
          <div className="risk-scale-fill" />
          <div className="risk-scale-ticks" aria-hidden="true" />
          <div className="risk-scale-sheen" />
          <div className="risk-scale-marker" data-score={animatedScore} aria-hidden="true" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold uppercase text-slate-500">
          <span className="risk-zone-label risk-zone-low">0-34</span>
          <span className="risk-zone-label risk-zone-medium justify-self-center">35-69</span>
          <span className="risk-zone-label risk-zone-high justify-self-end">70-100</span>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        Review priority {copy.label}, signal strength {targetScore} out of 100.
      </div>
      <p className="mt-5 text-base leading-7 text-slate-600">
        {copy.description} Use this as a triage signal, not a legal conclusion.
      </p>
    </section>
  );
}
