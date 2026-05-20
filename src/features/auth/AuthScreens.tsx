import { useMutation } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { InlineNotice, LogoMark, ThemeToggle } from "../../components/ui";
import { api } from "../../lib/api";
import type { LoginPayload, SignupPayload, ThemeMode } from "../../lib/appTypes";
import { errorMessage } from "../../lib/errors";
import { uniqueBatches, uniqueSections } from "../../lib/routine";
import type { CurrentUserResult, RoutineEntry } from "../../types";

export function Onboarding({
  current,
  entries,
  onSignOut,
  theme,
  onThemeToggle,
}: {
  current: CurrentUserResult;
  entries: RoutineEntry[];
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const completeProfile = useMutation(api.profiles.completeProfile);
  const batches = uniqueBatches(entries);
  const [batch, setBatch] = useState(batches[0] ?? "67");
  const sections = uniqueSections(entries, batch);
  const [section, setSection] = useState(sections[0] ?? "A");
  const selectedSection = sections.includes(section)
    ? section
    : (sections[0] ?? "A");
  const [fullName, setFullName] = useState(current.name ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await completeProfile({
        fullName,
        batch,
        section: selectedSection,
      });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel wide">
        <div className="auth-panel-top">
          <LogoMark />
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
        <h1>Complete Profile</h1>
        <p className="lead">{current.email}</p>
        <form className="profile-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <div className="form-row two">
            <label>
              Batch
              <select
                value={batch}
                onChange={(event) => {
                  const nextBatch = event.target.value;
                  setBatch(nextBatch);
                  setSection(uniqueSections(entries, nextBatch)[0] ?? "A");
                }}
              >
                {(batches.length ? batches : ["67"]).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select
                value={selectedSection}
                onChange={(event) => setSection(event.target.value)}
              >
                {(sections.length ? sections : ["A"]).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? <InlineNotice text={error} /> : null}
          <button className="primary-action full" type="submit" disabled={busy}>
            <CheckCircle2 size={18} /> {busy ? "Saving" : "Continue"}
          </button>
        </form>
        <button className="text-action" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export function SignInScreen({
  entries,
  error,
  onLogin,
  onSignup,
  theme,
  onThemeToggle,
}: {
  entries: RoutineEntry[];
  error: string;
  onLogin: (payload: LoginPayload) => Promise<void>;
  onSignup: (payload: SignupPayload) => Promise<void>;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const batches = uniqueBatches(entries);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [batch, setBatch] = useState(batches[0] ?? "67");
  const sections = uniqueSections(entries, batch);
  const [section, setSection] = useState(sections[0] ?? "A");
  const selectedSection = sections.includes(section)
    ? section
    : (sections[0] ?? "A");

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await onLogin({ email: loginEmail, password: loginPassword });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSignup({
        fullName,
        email: signupEmail,
        password: signupPassword,
        batch,
        section: selectedSection,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleBatchChange(nextBatch: string) {
    setBatch(nextBatch);
    setSection(uniqueSections(entries, nextBatch)[0] ?? "A");
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel auth-card">
        <div className="auth-header">
          <div className="auth-topline">
            <LogoMark />
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          </div>
          <div className="auth-heading">
            <h1>UU Attendance</h1>
            <p className="lead">
              Sign in with your Uttara University credentials.
            </p>
          </div>
        </div>

        <div
          className="auth-tabs"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            className={authMode === "login" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            onClick={() => setAuthMode("login")}
          >
            <LogIn size={16} />
            <span>Login</span>
          </button>
          <button
            className={authMode === "signup" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={authMode === "signup"}
            onClick={() => setAuthMode("signup")}
          >
            <UserPlus size={16} />
            <span>Create account</span>
          </button>
        </div>

        {authMode === "login" ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label className="field">
              <span className="field-label">Education email</span>
              <span className="input-wrap">
                <Mail size={16} className="input-icon" aria-hidden />
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="2262091038@uttara.ac.bd"
                  required
                />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <KeyRound size={16} className="input-icon" aria-hidden />
                <input
                  autoComplete="current-password"
                  minLength={4}
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="4 characters or more"
                  required
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  aria-label={
                    showLoginPassword ? "Hide password" : "Show password"
                  }
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {error ? <InlineNotice text={error} /> : null}
            <button
              className="primary-action full"
              type="submit"
              disabled={busy}
            >
              <LogIn size={18} /> {busy ? "Signing in" : "Sign in"}
            </button>
            <p className="auth-footnote">
              Only @uttara.ac.bd accounts can sign in.
            </p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignupSubmit}>
            <label className="field">
              <span className="field-label">Full name</span>
              <span className="input-wrap">
                <User size={16} className="input-icon" aria-hidden />
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Education email</span>
              <span className="input-wrap">
                <Mail size={16} className="input-icon" aria-hidden />
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  placeholder="2262091038@uttara.ac.bd"
                  required
                />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <KeyRound size={16} className="input-icon" aria-hidden />
                <input
                  autoComplete="new-password"
                  minLength={4}
                  type={showSignupPassword ? "text" : "password"}
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  placeholder="4 characters or more"
                  required
                />
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowSignupPassword((value) => !value)}
                  aria-label={
                    showSignupPassword ? "Hide password" : "Show password"
                  }
                >
                  {showSignupPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </span>
            </label>
            <div className="form-row two">
              <label className="field">
                <span className="field-label">Batch</span>
                <span className="input-wrap select">
                  <select
                    value={batch}
                    onChange={(event) => handleBatchChange(event.target.value)}
                  >
                    {(batches.length ? batches : ["67"]).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="field">
                <span className="field-label">Section</span>
                <span className="input-wrap select">
                  <select
                    value={selectedSection}
                    onChange={(event) => setSection(event.target.value)}
                  >
                    {(sections.length ? sections : ["A"]).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
            {error ? <InlineNotice text={error} /> : null}
            <button
              className="primary-action full"
              type="submit"
              disabled={busy}
            >
              <UserPlus size={18} />{" "}
              {busy ? "Creating account" : "Create account"}
            </button>
            <p className="auth-footnote">
              Student ID is taken from your email before @.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export function BlockedEmail({
  current,
  onSignOut,
  theme,
  onThemeToggle,
}: {
  current: CurrentUserResult | null;
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-top">
          <div className="brand-mark danger">
            <AlertCircle size={28} />
          </div>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
        <h1>Access Blocked</h1>
        <p className="lead">
          {current?.email || "This account"} is not an @uttara.ac.bd email.
        </p>
        <button
          className="secondary-action full"
          type="button"
          onClick={onSignOut}
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function SetupPreview({
  entries,
  loading,
  error,
  theme,
  onThemeToggle,
}: {
  entries: RoutineEntry[];
  loading: boolean;
  error: string;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const sections = [...new Set(entries.map((entry) => entry.batchLabel))].sort();

  return (
    <div className="auth-shell setup">
      <div className="auth-panel wide">
        <div className="auth-panel-top">
          <LogoMark />
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>
        <h1>UU Attendance</h1>
        <p className="lead">Convex is not connected yet.</p>
        <div className="setup-grid">
          <div>
            <strong>{loading ? "Loading" : entries.length}</strong>
            <span>Routine entries</span>
          </div>
          <div>
            <strong>{sections.length}</strong>
            <span>Sections</span>
          </div>
        </div>
        {error ? <InlineNotice text={error} /> : null}
        <div className="setup-steps">
          <code>npm run convex:dev</code>
          <code>set VITE_CONVEX_URL in .env.local</code>
          <code>set INITIAL_CR_EMAILS in Convex env</code>
        </div>
      </div>
    </div>
  );
}
