function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightedText({ text, terms = [], className = "" }) {
  const cleanTerms = [...new Set(terms.filter(Boolean).map((term) => term.trim()))]
    .filter((term) => term.length >= 3)
    .sort((first, second) => second.length - first.length);

  if (!text || cleanTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const matcher = new RegExp(`(${cleanTerms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(matcher);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = cleanTerms.some((term) => term.toLowerCase() === part.toLowerCase());
        if (!isMatch) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        return (
          <mark key={`${part}-${index}`} className="highlight-mark">
            {part}
          </mark>
        );
      })}
    </span>
  );
}
