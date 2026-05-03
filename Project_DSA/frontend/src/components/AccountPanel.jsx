import { useState } from "react";
import { History, LogOut, Settings, UserRound } from "lucide-react";

const preferenceOptions = [
  ["privacy", "Privacy"],
  ["hidden_fees", "Hidden fees"],
  ["employment_restrictions", "Employment restrictions"],
  ["cancellation_refunds", "Cancellation/refunds"],
];

export default function AccountPanel({
  user,
  historyItems,
  authError,
  onLogin,
  onSignup,
  onLogout,
  onOpenSaved,
  onRenameSaved,
  onDeleteSaved,
  onUpdatePreferences,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (mode === "signup") {
      await onSignup({ email, password });
    } else {
      await onLogin({ email, password });
    }
  }

  function togglePreference(key) {
    onUpdatePreferences({
      ...user.preferences,
      [key]: !user.preferences?.[key],
    });
  }

  if (!user) {
    return (
      <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
        <div className="flex items-start gap-4">
          <div className="metric-icon flex h-11 w-11 flex-none items-center justify-center text-teal-700">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold uppercase text-teal-700">Optional account</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Save reports and preferences</h2>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Phase 3 adds local accounts for saved analysis history. You can still analyze
              documents without signing in.
            </p>
          </div>
        </div>

        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="field-control h-12 px-4 text-base"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password, 8+ chars"
            className="field-control h-12 px-4 text-base"
            minLength={8}
            required
          />
          <button
            type="submit"
            className="primary-action inline-flex h-12 items-center justify-center gap-2 px-5 text-base font-bold text-white"
          >
            {mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-base font-bold text-teal-700"
          >
            {mode === "signup" ? "I already have an account" : "Create an account"}
          </button>
          {authError && <p className="text-base font-semibold text-red-700">{authError}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="scroll-reveal surface-card p-6" data-scroll-reveal>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-base font-bold uppercase text-teal-700">Signed in</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{user.email}</h2>
          <p className="mt-2 text-base leading-7 text-slate-600">
            Saved analyses stay in this local SQLite database until you delete them.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="secondary-action inline-flex h-11 items-center gap-2 px-4 text-base font-bold text-slate-800"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sign out
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="surface-card-muted p-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-950">Risk preferences</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {preferenceOptions.map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-lg bg-white/70 p-3 text-base font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(user.preferences?.[key])}
                  onChange={() => togglePreference(key)}
                  className="h-5 w-5 accent-teal-700"
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="surface-card-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-950">Saved history</h3>
            </div>
            <span className="doc-meta-pill px-3 py-1 text-sm font-bold">
              {historyItems.length} saved
            </span>
          </div>

          {historyItems.length === 0 ? (
            <p className="mt-4 text-base leading-7 text-slate-600">
              Analyze a document, then use Save report on the results page.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {historyItems.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-white/80 p-3">
                  {renamingId === item.id ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onRenameSaved(item.id, renameValue);
                        setRenamingId("");
                      }}
                    >
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        className="field-control h-10 flex-1 px-3 text-base"
                        autoFocus
                      />
                      <button className="primary-action h-10 px-4 text-sm font-bold text-white" type="submit">
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-bold text-slate-950">{item.document_name}</h4>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.document_type} · {item.risk_level} · {item.finding_count} findings
                          </p>
                        </div>
                        <span className="text-lg font-bold text-slate-900">{item.risk_score}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenSaved(item.id)}
                          className="secondary-action h-9 px-3 text-sm font-bold text-slate-800"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(item.id);
                            setRenameValue(item.document_name);
                          }}
                          className="secondary-action h-9 px-3 text-sm font-bold text-slate-800"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSaved(item.id)}
                          className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
