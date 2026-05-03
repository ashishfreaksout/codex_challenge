import { CheckCircle2 } from "lucide-react";

import ExpandableText from "./ExpandableText.jsx";

export default function TextList({ title, items, emptyText }) {
  return (
    <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {items?.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-base leading-7 text-slate-700">
              <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-teal-700" aria-hidden="true" />
              <ExpandableText
                as="span"
                text={item}
                className="block text-base leading-7 text-slate-700"
                collapsedLines={3}
                threshold={180}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-base leading-7 text-slate-600">{emptyText}</p>
      )}
    </section>
  );
}
