import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { CalendarCheck, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import "./App.css";
import { AppHeader } from "./components/AppHeader";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { FullPageStatus } from "./components/ui";
import {
  BlockedEmail,
  Onboarding,
  SetupPreview,
  SignInScreen,
} from "./features/auth/AuthScreens";
import { CrDashboard } from "./features/cr/CrDashboard";
import { StudentDashboard } from "./features/student/StudentDashboard";
import { useRoutineData } from "./hooks/useRoutineData";
import { useThemeMode } from "./hooks/useThemeMode";
import { api } from "./lib/api";
import type { LoginPayload, SignupPayload, ThemeMode } from "./lib/appTypes";
import { authErrorMessage } from "./lib/errors";
import { normalizeRoutineEntries } from "./lib/routine";
import type { RoutineEntry } from "./types";

function App({ backendReady }: { backendReady: boolean }) {
  const [theme, toggleTheme] = useThemeMode();
  const { routineData, loading, error } = useRoutineData();
  const entries = useMemo(
    () => normalizeRoutineEntries(routineData?.entries ?? []),
    [routineData],
  );

  const screen = backendReady ? (
    <AuthenticatedApp
      entries={entries}
      routineLoading={loading}
      theme={theme}
      onThemeToggle={toggleTheme}
    />
  ) : (
    <SetupPreview
      entries={entries}
      loading={loading}
      error={error}
      theme={theme}
      onThemeToggle={toggleTheme}
    />
  );

  return (
    <>
      {screen}
      <PwaInstallPrompt />
    </>
  );
}

function AuthenticatedApp({
  entries,
  routineLoading,
  theme,
  onThemeToggle,
}: {
  entries: RoutineEntry[];
  routineLoading: boolean;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const auth = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const current = useQuery(
    api.profiles.current,
    auth.isAuthenticated ? {} : "skip",
  );
  const [mode, setMode] = useState<"student" | "cr">("cr");
  const [authError, setAuthError] = useState("");

  async function handlePasswordLogin(payload: LoginPayload) {
    setAuthError("");
    try {
      const result = await signIn("password", {
        flow: "signIn",
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
      }
    } catch (error) {
      setAuthError(authErrorMessage(error));
    }
  }

  async function handlePasswordSignup(payload: SignupPayload) {
    setAuthError("");
    try {
      const result = await signIn("password", {
        flow: "signUp",
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        batch: payload.batch,
        section: payload.section,
      });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
      }
    } catch (error) {
      setAuthError(authErrorMessage(error));
    }
  }

  if (auth.isLoading || routineLoading) {
    return <FullPageStatus label="Loading attendance workspace" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <SignInScreen
        entries={entries}
        error={authError}
        onLogin={handlePasswordLogin}
        onSignup={handlePasswordSignup}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />
    );
  }

  if (current === undefined) {
    return <FullPageStatus label="Checking account" />;
  }

  if (!current?.isAllowedEmail) {
    return (
      <BlockedEmail
        current={current}
        onSignOut={signOut}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />
    );
  }

  if (!current.profile) {
    return (
      <Onboarding
        current={current}
        entries={entries}
        onSignOut={signOut}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />
    );
  }

  const profile = current.profile;
  const isCr = profile.role === "cr";

  return (
    <div className="app-shell">
      <AppHeader
        profile={profile}
        onSignOut={signOut}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      <main className="workspace">
        {isCr ? (
          <div className="toolbar-band">
            <div className="segmented" aria-label="Workspace mode">
              <button
                className={mode === "student" ? "active" : ""}
                type="button"
                onClick={() => setMode("student")}
              >
                <CalendarCheck size={16} /> Attend
              </button>
              <button
                className={mode === "cr" ? "active" : ""}
                type="button"
                onClick={() => setMode("cr")}
              >
                <ShieldCheck size={16} /> CR
              </button>
            </div>
          </div>
        ) : null}

        {mode === "cr" && isCr ? (
          <CrDashboard profile={profile} entries={entries} />
        ) : (
          <StudentDashboard profile={profile} entries={entries} />
        )}
      </main>
    </div>
  );
}

export default App;
