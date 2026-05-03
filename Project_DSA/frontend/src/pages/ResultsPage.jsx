import { ArrowLeft, FileText, RotateCcw, UserRound } from "lucide-react";

import AgreementDashboard from "../components/AgreementDashboard.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import DisclaimerBanner from "../components/DisclaimerBanner.jsx";
import ExpandableText from "../components/ExpandableText.jsx";
import ReportActions from "../components/ReportActions.jsx";
import RiskCard from "../components/RiskCard.jsx";
import RiskScoreGauge from "../components/RiskScoreGauge.jsx";
import SaveAnalysisBar from "../components/SaveAnalysisBar.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import TextList from "../components/TextList.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

export default function ResultsPage({
  analysis,
  user,
  isSaving,
  saveMessage,
  onEditInput,
  onStartOver,
  onSaveAnalysis,
  onOpenAccount,
}) {
  useScrollReveal([analysis]);

  return (
    <div className="page-shell min-h-screen">
      <header className="app-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <p className="text-base font-bold text-slate-950">Don't Sign Anything!</p>
              <p className="text-sm text-slate-500">Analysis report</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenAccount}
              className="secondary-action inline-flex h-11 items-center gap-2 px-4 text-base font-bold text-slate-800 transition"
              aria-label={user ? "Open account page" : "Open sign-in page"}
            >
              <UserRound className="h-4 w-4 text-teal-700" aria-hidden="true" />
              {user ? "Account" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={onEditInput}
              className="secondary-action inline-flex h-11 items-center gap-2 px-4 text-base font-bold text-slate-700 transition"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Edit input
            </button>
            <button
              type="button"
              onClick={onStartOver}
              className="primary-action inline-flex h-11 items-center gap-2 px-4 text-base font-bold text-white transition"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              New review
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="scroll-reveal doc-meta-pill mb-6 inline-flex flex-wrap items-center gap-3 px-4 py-2 text-base" data-scroll-reveal>
          <FileText className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <span className="font-semibold text-slate-950">
            {analysis.document_name || "Agreement"}
          </span>
          <span>{analysis.word_count} words reviewed</span>
          {analysis.document_type && <span>{analysis.document_type}</span>}
        </div>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <RiskScoreGauge score={analysis.risk_score} level={analysis.risk_level} />
          <section className="scroll-reveal surface-card p-7" data-scroll-reveal>
            <h1 className="text-3xl font-bold text-slate-950">Agreement brief</h1>
            <ExpandableText
              text={analysis.summary}
              className="mt-4 text-lg leading-8 text-slate-700"
              collapsedLines={4}
              threshold={260}
            />
            <div className="mt-5">
              <DisclaimerBanner compact />
            </div>
          </section>
        </section>

        <AgreementDashboard analysis={analysis} />

        <SaveAnalysisBar
          user={user}
          isSaving={isSaving}
          saveMessage={saveMessage}
          onSave={onSaveAnalysis}
        />

        <ReportActions analysis={analysis} />

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <TextList
            title="Obligations to track"
            items={analysis.obligations}
            emptyText="No obvious obligation sentences were detected by the Phase 1 rules."
          />
          <TextList
            title="Deadlines and notice windows"
            items={analysis.deadlines}
            emptyText="No obvious deadlines were detected by the Phase 1 rules."
          />
        </section>

        <section className="scroll-reveal surface-card mt-6 p-6" data-scroll-reveal>
          <h2 className="text-2xl font-bold text-slate-950">Questions before signing</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {analysis.questions_to_ask.map((question) => (
              <div key={question} className="surface-card-muted p-4 text-base leading-7 text-slate-700">
                <ExpandableText
                  text={question}
                  className="text-base leading-7 text-slate-700"
                  collapsedLines={3}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="scroll-reveal mt-8" data-scroll-reveal>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Detailed findings</h2>
              <p className="mt-1 text-base leading-7 text-slate-600">
                Open a finding to see the plain-English meaning, why it matters, source
                language, and questions to ask.
              </p>
            </div>
            <span className="doc-meta-pill px-4 py-2 text-base font-bold">
              {analysis.detected_risks.length} findings
            </span>
          </div>

          {analysis.detected_risks.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {analysis.detected_risks.map((risk) => (
                <RiskCard key={risk.id} risk={risk} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-teal-200 bg-teal-50/90 p-5 text-base leading-7 text-teal-950 shadow-sm">
              No configured Phase 1 review items were detected. Review the original document
              carefully because rule-based checks can miss important language.
            </div>
          )}
        </section>

        <section className="scroll-reveal surface-card mt-8 p-6" data-scroll-reveal>
          <h2 className="text-2xl font-bold text-slate-950">Next steps</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {analysis.next_steps.map((step) => (
              <li key={step} className="surface-card-muted p-4 text-base leading-7 text-slate-700">
                <ExpandableText
                  text={step}
                  className="text-base leading-7 text-slate-700"
                  collapsedLines={3}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
