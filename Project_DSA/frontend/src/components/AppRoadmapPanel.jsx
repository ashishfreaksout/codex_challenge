import { Apple, ExternalLink, Play, Smartphone } from "lucide-react";

const expoPreviewUrl = import.meta.env.VITE_EXPO_PREVIEW_URL || "exp://192.168.1.136:8081";
const expoWebPreviewUrl = import.meta.env.VITE_EXPO_WEB_PREVIEW_URL || "http://localhost:8081";

const plannedApps = [
  {
    name: "iOS app",
    platform: "Apple App Store",
    status: "MVP scaffold started",
    icon: Apple,
  },
  {
    name: "Android app",
    platform: "Google Play",
    status: "MVP scaffold started",
    icon: Play,
  },
];

export default function AppRoadmapPanel() {
  return (
    <section className="scroll-reveal surface-card p-6 md:p-7" data-scroll-reveal>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="metric-icon flex h-12 w-12 flex-none items-center justify-center text-teal-700">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold uppercase text-teal-700">Mobile apps</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Try the mobile preview with Expo</h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
              The apps are not published in the App Store or Google Play yet. For local testing,
              use Expo Go while the development server and backend are running on the same network.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={expoPreviewUrl}
                className="primary-action inline-flex h-12 items-center justify-center gap-2 px-5 text-base font-bold text-white transition"
              >
                Open Expo preview
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={expoWebPreviewUrl}
                className="secondary-action inline-flex h-12 items-center justify-center gap-2 px-5 text-base font-bold text-slate-800 transition"
              >
                Open web preview
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              Local preview links can change when your network or Expo server changes.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[26rem]">
          {plannedApps.map((app) => {
            const Icon = app.icon;
            return (
              <article key={app.name} className="surface-card-muted p-4">
                <div className="flex items-center gap-3">
                  <div className="icon-tile flex h-10 w-10 items-center justify-center text-slate-800">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">{app.name}</h3>
                    <p className="text-sm font-semibold text-slate-500">{app.platform}</p>
                  </div>
                </div>
                <span className="doc-meta-pill mt-4 inline-flex px-3 py-1 text-sm font-bold">
                  {app.status}
                </span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
