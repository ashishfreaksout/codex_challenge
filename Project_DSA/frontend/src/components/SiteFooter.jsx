import { ExternalLink, Github, ShieldCheck } from "lucide-react";

const githubBaseUrl = "https://github.com/ashishfreaksout/codex_challenge";

const footerColumns = [
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: `${githubBaseUrl}/blob/main/docs/privacy_policy.md` },
      { label: "Terms of use", href: `${githubBaseUrl}/blob/main/docs/terms_of_use.md` },
      { label: "Disclaimer", href: `${githubBaseUrl}/blob/main/docs/disclaimers.md` },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Roadmap", href: `${githubBaseUrl}/blob/main/docs/roadmap.md` },
      { label: "Risk categories", href: `${githubBaseUrl}/blob/main/docs/risk_categories.md` },
      { label: "Backend API notes", href: `${githubBaseUrl}/blob/main/backend/README.md` },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source resources", href: `${githubBaseUrl}/tree/main`, icon: Github },
      { label: "Mobile preview notes", href: `${githubBaseUrl}/blob/main/mobile/README.md` },
      { label: "Main README", href: `${githubBaseUrl}/blob/main/README.md` },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/82">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.2fr_1.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="metric-icon flex h-11 w-11 items-center justify-center text-teal-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-950">Don't Sign Anything!</p>
              <p className="text-sm font-semibold text-slate-500">Educational risk assistant</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            This product explains possible document risks in plain English. It is not legal
            advice, and it does not replace a licensed attorney.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            © {new Date().getFullYear()} Don't Sign Anything. MVP/developer preview.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-bold uppercase text-slate-500">{column.title}</h2>
              <ul className="mt-3 grid gap-2">
                {column.links.map((link) => {
                  const Icon = link.icon || ExternalLink;
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-base font-bold text-slate-700 transition hover:text-teal-700"
                      >
                        {link.icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                        <span>{link.label}</span>
                        {!link.icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
