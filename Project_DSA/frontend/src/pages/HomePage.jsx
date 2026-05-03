import {
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  ScanText,
  UserRound,
  UsersRound,
} from "lucide-react";

import AppRoadmapPanel from "../components/AppRoadmapPanel.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import ClauseEducationPanel from "../components/ClauseEducationPanel.jsx";
import DisclaimerBanner from "../components/DisclaimerBanner.jsx";
import FileDropZone from "../components/FileDropZone.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

const featureHighlights = [
  {
    title: "Signing brief",
    description: "A short explanation of what the document seems to say.",
    icon: ClipboardCheck,
  },
  {
    title: "Review priority",
    description: "A triage signal that shows which clauses need attention first.",
    icon: Gauge,
  },
  {
    title: "Parties and roles",
    description: "Names and roles when the agreement clearly defines them.",
    icon: UsersRound,
  },
  {
    title: "Plain words",
    description: "Simple explanations without legal jargon.",
    icon: ScanText,
  },
  {
    title: "Paper scans",
    description: "Upload clear photos or scans when OCR is configured.",
    icon: ScanText,
  },
  {
    title: "Questions",
    description: "Things to ask the other party before signing.",
    icon: MessageSquareText,
  },
];

export default function HomePage({
  inputText,
  documentName,
  error,
  isExtracting,
  isAnalyzing,
  onTextChange,
  onDocumentNameChange,
  onDocumentSelected,
  onAnalyze,
  user,
  onOpenAccount,
}) {
  const canAnalyze = inputText.trim().length >= 20 && !isExtracting && !isAnalyzing;
  useScrollReveal([Boolean(error)]);

  return (
    <div className="page-shell min-h-screen">
      <header className="app-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <p className="text-base font-bold text-slate-950">Don't Sign Anything!</p>
              <p className="text-sm text-slate-500">Phased MVP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="status-pill hidden px-4 py-2 text-sm font-bold sm:inline-flex">
              Educational assistant
            </span>
            <button
              type="button"
              onClick={onOpenAccount}
              className="secondary-action inline-flex h-11 items-center justify-center gap-2 px-4 text-base font-bold text-slate-800 transition"
              aria-label={user ? "Open account page" : "Open sign-in page"}
            >
              <UserRound className="h-5 w-5 text-teal-700" aria-hidden="true" />
              {user ? "Account" : "Sign in"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-12">
        <section className="grid gap-8 lg:grid-cols-[1.04fr_0.86fr] lg:items-center">
          <div className="scroll-reveal" data-scroll-reveal>
            <div className="eyebrow-pill inline-flex items-center gap-2 px-4 py-2 text-base font-bold">
              <FileSearch className="h-5 w-5 text-teal-700" aria-hidden="true" />
              Agreement review before signing
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-tight text-slate-950 sm:text-6xl">
              Understand the agreement before you sign it.
            </h1>
            <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-600">
              Upload a document or paste agreement text. The app turns legal language into a
              signing brief with review priorities, obligations, deadlines, parties, and
              questions to ask before you commit.
            </p>
          </div>

          <div className="scroll-reveal surface-card p-6 md:p-7" data-scroll-reveal>
            <p className="text-sm font-bold uppercase text-slate-500">What you get</p>
            <div className="mt-5">
              {featureHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="feature-row flex gap-3">
                    <div className="icon-tile flex h-10 w-10 flex-none items-center justify-center text-teal-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-base leading-7 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="scroll-reveal mt-8" data-scroll-reveal>
          <DisclaimerBanner />
        </div>

        <div className="mt-8">
          <ClauseEducationPanel />
        </div>

        <div className="mt-8">
          <AppRoadmapPanel />
        </div>

        {error && (
          <div className="scroll-reveal mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50/90 p-4 text-red-950 shadow-sm" data-scroll-reveal>
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <p className="text-base leading-7">{error}</p>
          </div>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="scroll-reveal surface-card p-6 md:p-7" data-scroll-reveal>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-slate-950">Document or scan upload</h2>
              <span className="text-sm font-bold uppercase text-slate-500">Files or photos</span>
            </div>
            <FileDropZone
              documentName={documentName}
              isExtracting={isExtracting}
              onDocumentSelected={onDocumentSelected}
            />
          </div>

          <div className="scroll-reveal surface-card p-6 md:p-7" data-scroll-reveal>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-slate-950">Agreement text</h2>
              <span className="text-sm font-bold uppercase text-slate-500">
                {inputText.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <label className="sr-only" htmlFor="document-name">
              Document name
            </label>
            <input
              id="document-name"
              value={documentName}
              onChange={(event) => onDocumentNameChange(event.target.value)}
              placeholder="Document name"
              className="field-control mb-3 h-12 w-full px-4 text-base text-slate-900 placeholder:text-slate-400 transition"
            />
            <label className="sr-only" htmlFor="agreement-text">
              Paste agreement text
            </label>
            <textarea
              id="agreement-text"
              value={inputText}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Paste agreement text here..."
              className="field-control min-h-80 w-full resize-y p-4 text-base leading-7 text-slate-900 placeholder:text-slate-400 transition"
            />
          </div>
        </section>

        <section className="scroll-reveal surface-card mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-scroll-reveal>
          <div className="flex gap-3">
            <div className="icon-tile flex h-10 w-10 flex-none items-center justify-center text-teal-700">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Privacy-minded MVP</h2>
              <p className="mt-1 text-base leading-7 text-slate-600">
                Accounts are optional. Uploaded files are processed in memory; saved history stores
                the analysis report, not the original uploaded file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="primary-action group inline-flex h-14 items-center justify-center gap-2 px-6 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-400"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
