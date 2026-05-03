import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ExpandableText({
  text,
  as: Component = "p",
  className = "",
  collapsedLines = 4,
  threshold = 220,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const content = String(text || "");
  const needsToggle = content.length > threshold;
  const shouldScrollExpanded = isExpanded && content.length > 1400;
  const displayClassName = [
    className,
    "whitespace-pre-wrap break-words",
    needsToggle && !isExpanded ? "expandable-text-collapsed" : "",
    shouldScrollExpanded ? "expandable-text-scroll" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0">
      <Component
        id={contentId}
        className={displayClassName}
        style={{ "--collapsed-lines": collapsedLines }}
      >
        {content}
      </Component>

      {needsToggle && (
        <button
          type="button"
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/85 px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
          {isExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
