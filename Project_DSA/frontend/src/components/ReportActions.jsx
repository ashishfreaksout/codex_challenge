import { Download, FileDown, Printer } from "lucide-react";

import {
  downloadHtmlReport,
  downloadTextReport,
  openPrintableReport,
} from "../utils/report.js";

export default function ReportActions({ analysis }) {
  return (
    <section className="scroll-reveal surface-card mt-6 p-6" data-scroll-reveal>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-base font-bold uppercase text-teal-700">Full report</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Download or print this analysis</h2>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
            The report is generated locally from the current analysis. It includes the score,
            document type, findings, source language, questions, next steps, and disclaimer.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadHtmlReport(analysis)}
            className="primary-action inline-flex h-12 items-center gap-2 px-4 text-base font-bold text-white transition"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Download HTML
          </button>
          <button
            type="button"
            onClick={() => downloadTextReport(analysis)}
            className="secondary-action inline-flex h-12 items-center gap-2 px-4 text-base font-bold text-slate-800 transition"
          >
            <FileDown className="h-5 w-5" aria-hidden="true" />
            Download text
          </button>
          <button
            type="button"
            onClick={() => openPrintableReport(analysis)}
            className="secondary-action inline-flex h-12 items-center gap-2 px-4 text-base font-bold text-slate-800 transition"
          >
            <Printer className="h-5 w-5" aria-hidden="true" />
            Print / save PDF
          </button>
        </div>
      </div>
    </section>
  );
}
