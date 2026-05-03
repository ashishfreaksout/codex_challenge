import { Scale } from "lucide-react";

export default function DisclaimerBanner({ compact = false }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${
        compact ? "p-4 text-base" : "p-5 text-base"
      }`}
    >
      <Scale className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
      <p className="leading-7">
        This is not legal advice. This educational agreement review assistant highlights
        clauses, tradeoffs, and plain-English questions to consider. Consult a licensed attorney
        for legal decisions.
      </p>
    </div>
  );
}
