import { useState } from "react";
import { Apple, ArrowLeft, Chrome, Facebook, Mail, ShieldCheck } from "lucide-react";

import AccountPanel from "../components/AccountPanel.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import useScrollReveal from "../hooks/useScrollReveal.js";

const authBenefits = [
  "Save reports so you can review them again later.",
  "Set what risks matter most to you.",
  "Delete saved reports when you no longer need them.",
];

const socialProviders = [
  { name: "Google", icon: Chrome },
  { name: "Facebook", icon: Facebook },
  { name: "Apple", icon: Apple },
];

export default function AuthPage({
  user,
  authError,
  historyItems,
  hasAnalysis,
  onBack,
  onLogin,
  onSignup,
  onLogout,
  onOpenSaved,
  onRenameSaved,
  onDeleteSaved,
  onUpdatePreferences,
}) {
  const [providerMessage, setProviderMessage] = useState("");

  useScrollReveal([Boolean(user), providerMessage]);

  function handleProviderClick(providerName) {
    setProviderMessage(
      `${providerName} sign-in needs OAuth app credentials before it can be enabled. Email sign-in works in this MVP.`,
    );
  }

  return (
    <div className="page-shell min-h-screen">
      <header className="app-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <p className="text-base font-bold text-slate-950">Don't Sign Anything!</p>
              <p className="text-sm text-slate-500">{user ? "Account" : "Sign in"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="secondary-action inline-flex h-11 items-center justify-center gap-2 px-4 text-base font-bold text-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {hasAnalysis ? "Back to report" : "Back to review"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">
        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="scroll-reveal surface-card p-7" data-scroll-reveal>
            <div className="metric-icon flex h-12 w-12 items-center justify-center text-teal-700">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-6 text-base font-bold uppercase text-teal-700">
              Optional account
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight text-slate-950">
              Save your review history without changing the core flow.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              You can still analyze documents without signing in. An account is only for saving
              reports, opening them later, and setting risk preferences.
            </p>
            <div className="mt-6 grid gap-3">
              {authBenefits.map((benefit) => (
                <div key={benefit} className="surface-card-muted p-4 text-base leading-7 text-slate-700">
                  {benefit}
                </div>
              ))}
            </div>
          </aside>

          <div className="grid gap-5">
            {!user && (
              <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
                <div className="flex items-start gap-4">
                  <div className="metric-icon flex h-11 w-11 flex-none items-center justify-center text-teal-700">
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-base font-bold uppercase text-teal-700">
                      Sign-in options
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950">
                      Choose how you want to continue
                    </h2>
                    <p className="mt-2 text-base leading-7 text-slate-600">
                      Email sign-in is active now. Social sign-in buttons are ready for the next
                      OAuth setup step.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {socialProviders.map((provider) => {
                    const Icon = provider.icon;
                    return (
                      <button
                        key={provider.name}
                        type="button"
                        onClick={() => handleProviderClick(provider.name)}
                        className="secondary-action auth-provider-button inline-flex h-12 items-center justify-center gap-2 px-4 text-base font-bold text-slate-800 transition"
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {provider.name}
                      </button>
                    );
                  })}
                </div>

                {providerMessage && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-7 text-amber-900">
                    {providerMessage}
                  </p>
                )}

                <div className="mt-5 flex items-center gap-3 text-sm font-bold uppercase text-slate-500">
                  <span className="h-px flex-1 bg-slate-200" />
                  Use email below
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              </section>
            )}

            <AccountPanel
              user={user}
              historyItems={historyItems}
              authError={authError}
              onLogin={onLogin}
              onSignup={onSignup}
              onLogout={onLogout}
              onOpenSaved={onOpenSaved}
              onRenameSaved={onRenameSaved}
              onDeleteSaved={onDeleteSaved}
              onUpdatePreferences={onUpdatePreferences}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
