import { Save } from "lucide-react";

export default function SaveAnalysisBar({ user, isSaving, saveMessage, onSave }) {
  return (
    <section className="scroll-reveal surface-card mt-6 p-6" data-scroll-reveal>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold uppercase text-teal-700">History</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Save this analysis</h2>
          <p className="mt-2 text-base leading-7 text-slate-600">
            {user
              ? "Save this report to your account history so you can open it later."
              : "Use Sign in in the top-right header to save analysis history."}
          </p>
          {saveMessage && <p className="mt-2 text-base font-semibold text-teal-700">{saveMessage}</p>}
        </div>
        <button
          type="button"
          disabled={!user || isSaving}
          onClick={onSave}
          className="primary-action inline-flex h-12 items-center justify-center gap-2 px-5 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-400"
        >
          <Save className="h-5 w-5" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save report"}
        </button>
      </div>
    </section>
  );
}
