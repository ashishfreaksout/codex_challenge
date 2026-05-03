import {
  BadgeDollarSign,
  CalendarClock,
  FileWarning,
  Handshake,
  LockKeyhole,
  RefreshCw,
  Scale,
  ShieldAlert,
  UserRoundX,
} from "lucide-react";

const watchClauses = [
  {
    title: "Money surprises",
    icon: BadgeDollarSign,
    description: "Extra fees, refund limits, collection costs, or big penalties.",
    keywords: ["fees may apply", "non-refundable", "termination fee"],
  },
  {
    title: "Hard to leave",
    icon: CalendarClock,
    description: "Rules that make cancellation easy to miss or expensive.",
    keywords: ["30 days notice", "automatic renewal", "may not cancel"],
  },
  {
    title: "Rights you give up",
    icon: Scale,
    description: "Language that changes how disputes are handled.",
    keywords: ["arbitration", "class action waiver", "jury trial waiver"],
  },
  {
    title: "Work limits",
    icon: UserRoundX,
    description: "Rules that affect future jobs, clients, or business ideas.",
    keywords: ["non-compete", "non-solicit", "competitive business"],
  },
  {
    title: "Privacy concerns",
    icon: LockKeyhole,
    description: "Terms that let personal information be shared or tracked.",
    keywords: ["third parties", "share data", "tracking"],
  },
  {
    title: "Changed later",
    icon: RefreshCw,
    description: "Terms that let the other side change the deal after signing.",
    keywords: ["at any time", "without notice", "sole discretion"],
  },
  {
    title: "Personal responsibility",
    icon: ShieldAlert,
    description: "Promises that can make you personally responsible for debt.",
    keywords: ["personal guarantee", "personally liable", "guarantor"],
  },
  {
    title: "Ownership of work",
    icon: FileWarning,
    description: "Terms about who owns work, ideas, files, designs, or code.",
    keywords: ["work product", "all rights", "intellectual property"],
  },
  {
    title: "Transferred deal",
    icon: Handshake,
    description: "Language that lets the agreement move to someone else.",
    keywords: ["assign", "transfer", "without consent"],
  },
];

export default function ClauseEducationPanel() {
  return (
    <section className="scroll-reveal" data-scroll-reveal>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-base font-bold uppercase text-teal-700">Before you sign</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Clauses and words to watch</h2>
        </div>
        <p className="max-w-xl text-base leading-7 text-slate-600">
          These are common words that can change money, privacy, rights, or your ability to walk away.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {watchClauses.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="scroll-reveal feature-card p-4" data-scroll-reveal>
              <div className="flex items-start gap-3">
                <div className="icon-tile flex h-11 w-11 flex-none items-center justify-center text-teal-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">{item.description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="token-pill px-3 py-1 text-sm font-semibold"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
