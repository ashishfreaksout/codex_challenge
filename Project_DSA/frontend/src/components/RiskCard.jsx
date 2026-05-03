import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Search,
} from "lucide-react";

import ExpandableText from "./ExpandableText.jsx";
import HighlightedText from "./HighlightedText.jsx";
import { severityClasses } from "../utils/risk.js";

export default function RiskCard({ risk }) {
  const [showDetails, setShowDetails] = useState(false);
  const badgeClass = severityClasses[risk.severity] || severityClasses.Low;

  return (
    <article className="scroll-reveal surface-card p-6" data-scroll-reveal>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-500">{risk.category}</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{risk.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
            {risk.confidence || 0}% confidence
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${badgeClass}`}>
            {risk.severity}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="flex gap-3 rounded-lg bg-teal-50 p-4">
          <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-teal-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase text-teal-800">Simple meaning</p>
            <ExpandableText
              text={risk.plain_english}
              className="mt-1 text-base leading-7 text-teal-950"
              collapsedLines={3}
            />
          </div>
        </div>
        <div className="flex gap-3 rounded-lg bg-amber-50 p-4">
          <AlertTriangle className="mt-1 h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase text-amber-800">Why it matters</p>
            <ExpandableText
              text={risk.why_it_matters || risk.explanation}
              className="mt-1 text-base leading-7 text-amber-950"
              collapsedLines={3}
            />
          </div>
        </div>
      </div>

      {risk.trigger_terms?.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold uppercase text-slate-500">Signals found</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {risk.trigger_terms.map((term) => (
              <span
                key={term}
                className="token-pill max-w-full break-words px-3 py-1 text-sm font-semibold"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="secondary-action mt-5 inline-flex h-11 items-center gap-2 px-4 text-base font-bold text-slate-800 transition"
        aria-expanded={showDetails}
      >
        {showDetails ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
        Source and checks
      </button>

      {showDetails && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-slate-950">
              <Search className="h-5 w-5 text-slate-500" aria-hidden="true" />
              Source language
            </div>
            {risk.matched_snippets?.length > 0 ? (
              <div className="space-y-3">
                {risk.matched_snippets.map((snippet) => (
                  <blockquote
                    key={snippet}
                    className="rounded-lg border border-slate-200 border-l-4 border-l-amber-400 bg-white/70 p-4 text-base leading-7 text-slate-800"
                  >
                    <HighlightedText
                      text={snippet}
                      terms={risk.trigger_terms || []}
                      className="text-base leading-7 text-slate-800"
                    />
                  </blockquote>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-base leading-7 text-slate-600">
                The analyzer found matching words, but no full sentence could be isolated.
              </p>
            )}
          </div>

          {risk.what_to_check?.length > 0 && (
            <div>
              <p className="mb-2 text-base font-bold text-slate-950">What to confirm</p>
              <ul className="space-y-2">
                {risk.what_to_check.map((item) => (
                  <li key={item} className="surface-card-muted flex gap-3 p-3 text-base leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-teal-700" aria-hidden="true" />
                    <ExpandableText
                      as="span"
                      text={item}
                      className="block text-base leading-7 text-slate-700"
                      collapsedLines={3}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {risk.questions?.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-base font-bold text-slate-950">
            <HelpCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />
            Questions to ask
          </div>
          <ul className="space-y-2 text-base leading-7 text-slate-700">
            {risk.questions.map((question) => (
              <li key={question} className="surface-card-muted px-3 py-2">
                <ExpandableText
                  text={question}
                  className="text-base leading-7 text-slate-700"
                  collapsedLines={3}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
