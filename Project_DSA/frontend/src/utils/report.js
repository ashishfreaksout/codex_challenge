const REPORT_DISCLAIMER =
  "This is not legal advice. This educational report flags potential document risks and plain-English questions to consider. Consult a licensed attorney for legal decisions.";

export function downloadHtmlReport(analysis) {
  const html = buildHtmlReport(analysis);
  downloadBlob(html, `${reportFileBase(analysis)}.html`, "text/html;charset=utf-8");
}

export function downloadTextReport(analysis) {
  const text = buildTextReport(analysis);
  downloadBlob(text, `${reportFileBase(analysis)}.txt`, "text/plain;charset=utf-8");
}

export function openPrintableReport(analysis) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    downloadHtmlReport(analysis);
    return false;
  }

  printWindow.document.write(buildHtmlReport(analysis, { autoPrint: true }));
  printWindow.document.close();
  printWindow.focus();
  return true;
}

export function buildTextReport(analysis) {
  const generatedAt = new Date().toLocaleString();
  const risks = analysis.detected_risks || [];

  return [
    "DON'T SIGN ANYTHING! - DOCUMENT RISK REPORT",
    `Generated: ${generatedAt}`,
    `Document: ${valueOrFallback(analysis.document_name, "Agreement")}`,
    `Document type: ${valueOrFallback(analysis.document_type, "Unknown document")} (${analysis.document_type_confidence || 0}% confidence)`,
    `Risk score: ${analysis.risk_score}/100`,
    `Risk level: ${analysis.risk_level}`,
    `Words reviewed: ${analysis.word_count || 0}`,
    "",
    "DISCLAIMER",
    REPORT_DISCLAIMER,
    "",
    "SUMMARY",
    valueOrFallback(analysis.summary, "No summary was generated."),
    "",
    "DOCUMENT TYPE SIGNALS",
    formatTextList(analysis.document_type_signals, "No classification signals were found."),
    "",
    "SCORING NOTES",
    formatTextList(analysis.scoring_notes, "No scoring notes were generated."),
    "",
    "DETAILED FINDINGS",
    risks.length > 0
      ? risks.map(formatRiskText).join("\n\n")
      : "No configured review items were detected.",
    "",
    "OBLIGATIONS TO TRACK",
    formatTextList(analysis.obligations, "No obvious obligations were detected."),
    "",
    "DEADLINES AND NOTICE WINDOWS",
    formatTextList(analysis.deadlines, "No obvious deadlines were detected."),
    "",
    "QUESTIONS BEFORE SIGNING",
    formatTextList(analysis.questions_to_ask, "No questions were generated."),
    "",
    "NEXT STEPS",
    formatTextList(analysis.next_steps, "No next steps were generated."),
    "",
  ].join("\n");
}

export function buildHtmlReport(analysis, options = {}) {
  const generatedAt = new Date().toLocaleString();
  const risks = analysis.detected_risks || [];
  const title = `${valueOrFallback(analysis.document_name, "Agreement")} - Risk Report`;
  const autoPrintScript = options.autoPrint
    ? "<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>"
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
      background: #f8fafc;
    }
    body {
      margin: 0;
      background: #f8fafc;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 40px 22px;
    }
    header,
    section {
      background: #ffffff;
      border: 1px solid #dbe3ee;
      border-radius: 10px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      margin-bottom: 18px;
      padding: 24px;
    }
    h1,
    h2,
    h3 {
      line-height: 1.18;
      margin: 0;
    }
    h1 {
      font-size: 34px;
    }
    h2 {
      font-size: 23px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    p {
      margin: 8px 0 0;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 22px;
    }
    li {
      margin: 6px 0;
    }
    .muted {
      color: #64748b;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .metric {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 24px;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
      padding: 5px 10px;
    }
    .badge-high {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .badge-medium {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-low {
      background: #f0fdfa;
      color: #115e59;
      border: 1px solid #99f6e4;
    }
    .risk {
      border: 1px solid #e2e8f0;
      border-left: 5px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin-top: 12px;
    }
    .risk-top {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }
    blockquote {
      background: #f8fafc;
      border-left: 4px solid #f59e0b;
      margin: 12px 0 0;
      padding: 12px 14px;
    }
    mark {
      background: #fde68a;
      border-radius: 4px;
      color: #78350f;
      font-weight: 800;
      padding: 0 3px;
    }
    .disclaimer {
      background: #fffbeb;
      border-color: #fde68a;
      color: #78350f;
    }
    @media print {
      body {
        background: #ffffff;
      }
      main {
        max-width: none;
        padding: 0;
      }
      header,
      section {
        box-shadow: none;
        break-inside: avoid;
      }
      .risk {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="muted"><strong>Don't Sign Anything!</strong> educational document risk assistant</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">Generated ${escapeHtml(generatedAt)}</p>
      <div class="meta-grid">
        ${metricHtml("Risk score", `${analysis.risk_score || 0}/100`)}
        ${metricHtml("Risk level", valueOrFallback(analysis.risk_level, "Unknown"))}
        ${metricHtml("Document type", valueOrFallback(analysis.document_type, "Unknown document"))}
        ${metricHtml("Type confidence", `${analysis.document_type_confidence || 0}%`)}
        ${metricHtml("Words reviewed", String(analysis.word_count || 0))}
        ${metricHtml("Findings", String(risks.length))}
      </div>
    </header>

    <section class="disclaimer">
      <h2>Important Disclaimer</h2>
      <p>${escapeHtml(REPORT_DISCLAIMER)}</p>
    </section>

    ${sectionHtml("Plain-English Summary", paragraphHtml(analysis.summary))}
    ${sectionHtml("Document Classification", [
      paragraphHtml(analysis.document_type_explanation),
      listHtml(analysis.document_type_signals, "No classification signals were found."),
    ].join(""))}
    ${sectionHtml("Scoring Notes", listHtml(analysis.scoring_notes, "No scoring notes were generated."))}
    ${sectionHtml("Detailed Findings", risks.length > 0 ? risks.map(riskHtml).join("") : "<p>No configured review items were detected.</p>")}
    ${sectionHtml("Obligations To Track", listHtml(analysis.obligations, "No obvious obligations were detected."))}
    ${sectionHtml("Deadlines And Notice Windows", listHtml(analysis.deadlines, "No obvious deadlines were detected."))}
    ${sectionHtml("Questions Before Signing", listHtml(analysis.questions_to_ask, "No questions were generated."))}
    ${sectionHtml("Next Steps", listHtml(analysis.next_steps, "No next steps were generated."))}
  </main>
  ${autoPrintScript}
</body>
</html>`;
}

function riskHtml(risk) {
  const badgeClass = `badge-${String(risk.severity || "Low").toLowerCase()}`;
  const snippets = risk.matched_snippets?.length
    ? risk.matched_snippets.map((snippet) => `<blockquote>${highlightTerms(snippet, risk.trigger_terms || [])}</blockquote>`).join("")
    : "<p class=\"muted\">No source sentence was isolated.</p>";

  return `<article class="risk">
    <div class="risk-top">
      <div>
        <p class="muted">${escapeHtml(risk.category || "Review item")}</p>
        <h3>${escapeHtml(risk.title || "Untitled finding")}</h3>
      </div>
      <div>
        <span class="badge ${badgeClass}">${escapeHtml(risk.severity || "Low")}</span>
      </div>
    </div>
    <p><strong>Confidence:</strong> ${risk.confidence || 0}%</p>
    <p><strong>Simple meaning:</strong> ${escapeHtml(risk.plain_english || "")}</p>
    <p><strong>Why it matters:</strong> ${escapeHtml(risk.why_it_matters || risk.explanation || "")}</p>
    <p><strong>Signals found:</strong> ${escapeHtml((risk.trigger_terms || []).join(", ") || "None")}</p>
    ${snippets}
    <h3>What to confirm</h3>
    ${listHtml(risk.what_to_check, "No checklist items were generated.")}
    <h3>Questions to ask</h3>
    ${listHtml(risk.questions, "No questions were generated for this finding.")}
  </article>`;
}

function formatRiskText(risk) {
  return [
    `${risk.title || "Untitled finding"} (${risk.severity || "Low"}, ${risk.confidence || 0}% confidence)`,
    `Category: ${valueOrFallback(risk.category, "Review item")}`,
    `Simple meaning: ${valueOrFallback(risk.plain_english, "No explanation generated.")}`,
    `Why it matters: ${valueOrFallback(risk.why_it_matters || risk.explanation, "No detail generated.")}`,
    `Signals found: ${(risk.trigger_terms || []).join(", ") || "None"}`,
    "Source language:",
    formatTextList(risk.matched_snippets, "No source sentence was isolated."),
    "What to confirm:",
    formatTextList(risk.what_to_check, "No checklist items were generated."),
    "Questions to ask:",
    formatTextList(risk.questions, "No questions were generated for this finding."),
  ].join("\n");
}

function sectionHtml(title, content) {
  return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function metricHtml(label, value) {
  return `<div class="metric"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function paragraphHtml(value) {
  return `<p>${escapeHtml(valueOrFallback(value, "No information was generated."))}</p>`;
}

function listHtml(items, emptyText) {
  if (!items || items.length === 0) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function formatTextList(items, emptyText) {
  if (!items || items.length === 0) {
    return emptyText;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function highlightTerms(text, terms) {
  const cleanTerms = [...new Set((terms || []).filter(Boolean).map((term) => term.trim()))]
    .filter((term) => term.length >= 3)
    .sort((first, second) => second.length - first.length);

  if (!text || cleanTerms.length === 0) {
    return escapeHtml(text || "");
  }

  const matcher = new RegExp(`(${cleanTerms.map(escapeRegex).join("|")})`, "gi");
  return escapeHtml(text).replace(matcher, "<mark>$1</mark>");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function reportFileBase(analysis) {
  const name = valueOrFallback(analysis.document_name, "agreement");
  const date = new Date().toISOString().slice(0, 10);
  return `${slugify(name)}-risk-report-${date}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "agreement";
}

function valueOrFallback(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function escapeHtml(value) {
  return valueOrFallback(value, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
