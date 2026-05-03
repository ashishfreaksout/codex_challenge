import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  FileWarning,
  FileSearch,
  HelpCircle,
  IdCard,
  ShieldAlert,
} from "lucide-react";

import ExpandableText from "./ExpandableText.jsx";
import { severityClasses } from "../utils/risk.js";

const severityOrder = ["High", "Medium", "Low"];

const severityMeta = {
  High: {
    color: "bg-red-500",
    text: "text-red-700",
  },
  Medium: {
    color: "bg-amber-500",
    text: "text-amber-700",
  },
  Low: {
    color: "bg-teal-500",
    text: "text-teal-700",
  },
};

export default function AgreementDashboard({ analysis }) {
  const risks = analysis.detected_risks || [];
  const severityCounts = severityOrder.reduce((counts, severity) => {
    counts[severity] = risks.filter((risk) => risk.severity === severity).length;
    return counts;
  }, {});
  const totalRisks = risks.length;
  const parties = analysis.parties || [];
  const highRiskCount = severityCounts.High || 0;
  const categoryCounts = risks.reduce((counts, risk) => {
    counts[risk.category] = (counts[risk.category] || 0) + 1;
    return counts;
  }, {});
  const categories = Object.entries(categoryCounts)
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 6);
  const maxCategoryCount = Math.max(...categories.map(([, count]) => count), 1);
  const priorityRisks = [...risks]
    .sort((firstRisk, secondRisk) => {
      const firstPriority = severityOrder.indexOf(firstRisk.severity);
      const secondPriority = severityOrder.indexOf(secondRisk.severity);
      return firstPriority - secondPriority;
    })
    .slice(0, 3);
  const uniqueTerms = new Set(risks.flatMap((risk) => risk.trigger_terms || []));
  const highAttentionDetail =
    highRiskCount === 0
      ? "None found"
      : highRiskCount === 1
        ? "Needs close review"
        : "Need close review";

  const metrics = [
    {
      label: "Review items",
      value: totalRisks,
      detail: "Clauses to review",
      icon: FileWarning,
      tone: "text-slate-700",
    },
    {
      label: "High attention",
      value: highRiskCount,
      detail: highAttentionDetail,
      icon: ShieldAlert,
      tone: highRiskCount > 0 ? "text-red-700" : "text-teal-700",
    },
    {
      label: "Obligations",
      value: analysis.obligations?.length || 0,
      detail: "Promises to track",
      icon: CheckCircle2,
      tone: "text-teal-700",
    },
    {
      label: "Timing items",
      value: analysis.deadlines?.length || 0,
      detail: "Deadlines or notice windows",
      icon: CalendarClock,
      tone: "text-amber-700",
    },
    {
      label: "Questions",
      value: analysis.questions_to_ask?.length || 0,
      detail: "Ask before signing",
      icon: HelpCircle,
      tone: "text-slate-700",
    },
    {
      label: "Signal words",
      value: uniqueTerms.size,
      detail: "Terms that triggered rules",
      icon: FileText,
      tone: "text-slate-700",
    },
  ];

  return (
    <section className="mt-8" aria-labelledby="agreement-dashboard-heading">
      <div className="scroll-reveal mb-4 flex flex-wrap items-end justify-between gap-3" data-scroll-reveal>
        <div>
          <p className="text-base font-bold uppercase text-teal-700">Signing brief</p>
          <h2 id="agreement-dashboard-heading" className="mt-2 text-2xl font-bold text-slate-950">
            What to understand before signing
          </h2>
        </div>
        <span className="doc-meta-pill px-4 py-2 text-base font-bold">
          {analysis.word_count} words reviewed
        </span>
      </div>

      <section className="scroll-reveal surface-card mb-5 p-6" data-scroll-reveal>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="metric-icon flex h-12 w-12 flex-none items-center justify-center text-teal-700">
              <FileSearch className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-slate-500">Document type</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-950">
                {analysis.document_type || "Unknown document"}
              </h3>
              <p className="mt-2 text-base leading-7 text-slate-600">
                {analysis.document_type_explanation ||
                  "The classifier did not find enough type-specific signals."}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-bold uppercase text-slate-500">Classification confidence</span>
              <span className="text-base font-bold text-slate-800">
                {analysis.document_type_confidence || 0}%
              </span>
            </div>
            <div className="theme-bar">
              <div
                className="theme-bar-fill"
                style={{ width: `${Math.max(6, analysis.document_type_confidence || 0)}%` }}
              />
            </div>
            {analysis.document_type_signals?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.document_type_signals.map((signal) => (
                  <span key={signal} className="token-pill px-3 py-1 text-sm font-semibold">
                    {signal}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="scroll-reveal metric-card p-4"
              data-scroll-reveal
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase text-slate-500">{metric.label}</p>
                  <p className={`mt-2 text-3xl font-bold ${metric.tone}`}>{metric.value}</p>
                </div>
                <div className="metric-icon flex h-10 w-10 flex-none items-center justify-center text-slate-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">{metric.detail}</p>
            </article>
          );
        })}
      </div>

      <section className="scroll-reveal mt-5" data-scroll-reveal>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold uppercase text-teal-700">Focus area</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">Top things to review first</h3>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
        </div>
        {priorityRisks.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {priorityRisks.map((risk) => (
              <article key={risk.id} className="surface-card-muted p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-sm font-bold uppercase text-slate-500">{risk.category}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      severityClasses[risk.severity] || severityClasses.Low
                    }`}
                  >
                    {risk.severity}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-950">{risk.title}</h4>
                <ExpandableText
                  text={risk.plain_english}
                  className="mt-2 text-base leading-7 text-slate-600"
                  collapsedLines={3}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-base leading-7 text-teal-950">
            No top review items were produced by the current rules.
          </div>
        )}
      </section>

      {parties.length > 0 && (
        <section className="scroll-reveal mt-5" data-scroll-reveal>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold uppercase text-teal-700">Who is involved</p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">Parties and roles</h3>
            </div>
            <span className="doc-meta-pill inline-flex items-center gap-2 px-4 py-2 text-base font-bold">
              <IdCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
              {parties.length} found
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {parties.map((party) => (
              <article
                key={`${party.name}-${party.role}`}
                className="surface-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase text-slate-500">
                      {party.role || "Defined party"}
                    </p>
                    <h4 className="mt-1 text-lg font-bold text-slate-950">{party.name}</h4>
                  </div>
                  <div className="icon-tile flex h-9 w-9 flex-none items-center justify-center text-teal-700">
                    <IdCard className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <ExpandableText
                  text={party.description}
                  className="mt-3 text-base leading-7 text-slate-600"
                  collapsedLines={3}
                />
                {party.source_text && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-500">
                    Found as: {party.source_text}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-950">Attention mix</h3>
              <p className="mt-1 text-base leading-7 text-slate-600">
                How the review items are prioritized.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                severityClasses[analysis.risk_level] || severityClasses.Low
              }`}
            >
              {analysis.risk_level} attention
            </span>
          </div>

          <div className="attention-mix-track mt-6">
            <div className="flex h-full">
              {totalRisks > 0 ? (
                severityOrder.map((severity) => {
                  const count = severityCounts[severity] || 0;
                  if (count === 0) {
                    return null;
                  }

                  return (
                    <div
                      key={severity}
                      className={`attention-segment ${severityMeta[severity].color}`}
                      style={{ width: `${(count / totalRisks) * 100}%` }}
                    />
                  );
                })
              ) : (
                <div className="attention-segment h-full w-full bg-teal-500" />
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {severityOrder.map((severity) => (
              <div
                key={severity}
                className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${severityMeta[severity].color}`} />
                  <p className="text-sm font-bold uppercase text-slate-600">{severity}</p>
                </div>
                <p className={`text-2xl font-bold ${severityMeta[severity].text}`}>
                  {severityCounts[severity] || 0}
                </p>
              </div>
            ))}
          </div>

          {analysis.scoring_notes?.length > 0 && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-bold uppercase text-slate-500">Scoring notes</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                {analysis.scoring_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
          <h3 className="text-xl font-bold text-slate-950">Review themes</h3>
          <div className="mt-5 grid gap-4">
            {categories.length > 0 ? (
              categories.map(([category, count]) => (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-base">
                    <span className="font-bold text-slate-800">{category}</span>
                    <span className="font-semibold text-slate-500">
                      {count} {count === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="theme-bar">
                    <div
                      className="theme-bar-fill"
                      style={{ width: `${Math.max(12, (count / maxCategoryCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-base leading-7 text-teal-950">
                No configured review themes were detected.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
