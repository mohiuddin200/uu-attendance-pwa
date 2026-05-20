import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Sun,
  Timer,
  User,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./App.css";
import { api } from "./lib/api";
import { downloadAttendancePdf } from "./lib/pdf";
import {
  formatDateTime,
  formatClockRange,
  formatClockTime,
  formatTime,
  getDayName,
  getNextClass,
  getTodayRoutine,
  loadRoutineData,
  normalizeRoutineEntries,
  uniqueBatches,
  uniqueSections,
} from "./lib/routine";
import type {
  AttendanceSession,
  CurrentUserResult,
  Profile,
  RoutineData,
  RoutineEntry,
  RecentAttendanceRecord,
  SessionDetails,
} from "./types";

type LoginPayload = {
  email: string;
  password: string;
};

type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
  batch: string;
  section: string;
};

type ThemeMode = "light" | "dark";
type ToastKind = "success" | "error" | "info";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "uu-attendance-install-dismissed";
type ToastState = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

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
      setAuthError(errorMessage(error));
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
      setAuthError(errorMessage(error));
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

type StudentView = "attend" | "today" | "recent";

function StudentDashboard({
  profile,
  entries,
}: {
  profile: Profile;
  entries: RoutineEntry[];
}) {
  const now = useNow();
  const activeSessions = useQuery(api.attendance.activeForMe, {});
  const recentRecords = useQuery(api.attendance.myRecentRecords, { limit: 6 });
  const submitAttendance = useMutation(api.attendance.submit);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [view, setView] = useState<StudentView>("attend");
  const todayRoutine = getTodayRoutine(entries, profile.batch, profile.section);
  const nextClass = getNextClass(entries, profile.batch, profile.section);
  const active = (activeSessions ?? []).filter(
    (session) => session.closesAt > now,
  );
  const submittedSessionIds = new Set(
    (recentRecords ?? []).map(({ record }) => record.sessionId),
  );

  async function handleSubmit(sessionId: string) {
    setPendingSession(sessionId);
    setToast(null);
    try {
      await submitAttendance({ sessionId });
      setToast(
        createToast(
          "success",
          "Attendance submitted",
          "Your presence was saved for this class.",
        ),
      );
    } catch (error) {
      setToast(createErrorToast(error, "Could not submit attendance"));
    } finally {
      setPendingSession(null);
    }
  }

  return (
    <>
      <div className="student-layout" data-active-tab={view}>
        <section
          className={`section-main tab-panel ${view === "attend" ? "is-active" : ""}`}
        >
          <SectionTitle
            icon={<CalendarCheck size={18} />}
            title="Attendance"
            subtitle={`Batch ${profile.batch}, Section ${profile.section}`}
          />

          {activeSessions === undefined ? (
            <PanelStatus label="Checking active attendance" />
          ) : active.length > 0 ? (
            <div className="stack">
              {active.map((session) => (
                <ActiveAttendanceCard
                  key={session._id}
                  session={session}
                  now={now}
                  submitted={submittedSessionIds.has(session._id)}
                  pending={pendingSession === session._id}
                  onSubmit={() => handleSubmit(session._id)}
                />
              ))}
            </div>
          ) : (
            <EmptyAttendance nextClass={nextClass} />
          )}

        </section>

        <aside className="side-panel">
          <div className={`tab-panel ${view === "today" ? "is-active" : ""}`}>
            <SectionTitle
              icon={<BookOpen size={18} />}
              title="Today"
              subtitle={getDayName()}
            />
            <RoutineList
              entries={todayRoutine}
              emptyText="No routine classes today."
            />
          </div>

          <div className={`tab-panel ${view === "recent" ? "is-active" : ""}`}>
            <SectionTitle
              icon={<FileText size={18} />}
              title="Recent"
              subtitle="Your submissions"
            />
            <RecentList records={recentRecords} />
          </div>
        </aside>
      </div>

      <AppToast toast={toast} onDismiss={() => setToast(null)} />

      <BottomNav<StudentView>
        active={view}
        onChange={setView}
        tabs={[
          { id: "attend", label: "Attend", icon: <CalendarCheck size={20} /> },
          { id: "today", label: "Today", icon: <BookOpen size={20} /> },
          { id: "recent", label: "Recent", icon: <FileText size={20} /> },
        ]}
      />
    </>
  );
}

type CrView = "routine" | "sessions" | "people";

const WEEK_ORDER: string[] = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function CrDashboard({
  profile,
  entries,
}: {
  profile: Profile;
  entries: RoutineEntry[];
}) {
  const now = useNow();
  const todayName = getDayName();
  const sectionRoutine = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.batch === profile.batch && entry.section === profile.section,
        )
        .sort(
          (a, b) =>
            WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day) ||
            a.start.localeCompare(b.start),
        ),
    [entries, profile.batch, profile.section],
  );
  const availableDays = useMemo(
    () => WEEK_ORDER.filter((day) => sectionRoutine.some((e) => e.day === day)),
    [sectionRoutine],
  );
  const [explicitDay, setExplicitDay] = useState<string | null>(null);
  const dayFilter: string =
    explicitDay ??
    (availableDays.includes(todayName)
      ? todayName
      : (availableDays[0] ?? "all"));
  const routineForOpening = useMemo(
    () =>
      dayFilter === "all"
        ? sectionRoutine
        : sectionRoutine.filter((e) => e.day === dayFilter),
    [sectionRoutine, dayFilter],
  );
  const routineTitle =
    dayFilter === "all"
      ? "Section Routine"
      : dayFilter === todayName
        ? "Today's Routine"
        : `${dayFilter} Routine`;
  const sessions = useQuery(api.attendance.sessionsForCr, { limit: 12 });
  const roster = useQuery(api.profiles.listSectionPeople, {});
  const openSession = useMutation(api.attendance.openSession);
  const closeSession = useMutation(api.attendance.closeSession);
  const inviteCr = useMutation(api.profiles.inviteCr);
  const manualMarkPresent = useMutation(api.attendance.manualMarkPresent);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [view, setView] = useState<CrView>("routine");
  const [manualForm, setManualForm] = useState({
    fullName: "",
    email: "",
    reason: "",
  });
  const activeSessionId = selectedSessionId ?? sessions?.[0]?._id ?? null;
  const details = useQuery(
    api.attendance.sessionDetails,
    activeSessionId ? { sessionId: activeSessionId } : "skip",
  );

  async function handleOpen(entry: RoutineEntry) {
    setBusy(entry.id);
    setToast(null);
    try {
      const routine = {
        id: entry.id,
        batch: entry.batch,
        section: entry.section,
        course: entry.course,
        courseTitle: entry.courseTitle,
        teacher: entry.teacher,
        room: entry.room,
        mode: entry.mode,
        program: entry.program,
        day: entry.day,
        start: entry.start,
        end: entry.end,
      };
      const session = await openSession({ routine, durationMinutes });
      setSelectedSessionId(session._id);
      setToast(
        createToast(
          "success",
          "Attendance opened",
          `${entry.course} is open for ${durationMinutes} minutes.`,
        ),
      );
    } catch (error) {
      setToast(createErrorToast(error, "Could not open attendance"));
    } finally {
      setBusy("");
    }
  }

  async function handleClose(sessionId: string) {
    setBusy(sessionId);
    setToast(null);
    try {
      await closeSession({ sessionId });
      setToast(createToast("success", "Attendance closed"));
    } catch (error) {
      setToast(createErrorToast(error, "Could not close attendance"));
    } finally {
      setBusy("");
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("invite");
    setToast(null);
    try {
      await inviteCr({
        email: inviteEmail,
        batch: profile.batch,
        section: profile.section,
      });
      setInviteEmail("");
      setToast(createToast("success", "CR invite saved"));
    } catch (error) {
      setToast(createErrorToast(error, "Could not invite CR"));
    } finally {
      setBusy("");
    }
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details?.session) return;

    setBusy("manual");
    setToast(null);
    try {
      await manualMarkPresent({
        sessionId: details.session._id,
        ...manualForm,
      });
      setManualForm({ fullName: "", email: "", reason: "" });
      setToast(createToast("success", "Manual attendance added"));
    } catch (error) {
      setToast(createErrorToast(error, "Could not add attendance"));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="cr-layout" data-active-tab={view}>
        <section
          className={`section-main tab-panel ${view === "routine" ? "is-active" : ""}`}
        >
          <div className="section-heading-row">
            <SectionTitle
              icon={<BookOpen size={18} />}
              title={routineTitle}
              subtitle={`Batch ${profile.batch}, Section ${profile.section}`}
            />
            <div className="routine-controls">
              <label className="duration-control">
                <BookOpen size={16} />
                <span>Day</span>
                <select
                  value={dayFilter}
                  onChange={(event) => setExplicitDay(event.target.value)}
                >
                  <option value="all">All days</option>
                  {availableDays.map((day) => (
                    <option key={day} value={day}>
                      {day === todayName ? `${day} (Today)` : day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="duration-control">
                <Timer size={16} />
                <span>Open for</span>
                <select
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(Number(event.target.value))
                  }
                >
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                </select>
              </label>
            </div>
          </div>

          {routineForOpening.length === 0 ? (
            <p className="muted-block">
              No classes scheduled
              {dayFilter !== "all" ? ` for ${dayFilter}` : ""}.
            </p>
          ) : null}

          <div className="class-grid">
            {routineForOpening.map((entry) => (
              <RoutineOpenCard
                key={entry.id}
                entry={entry}
                busy={busy === entry.id}
                onOpen={() => handleOpen(entry)}
              />
            ))}
          </div>

        </section>

        <aside className="side-panel cr-side">
          <div
            className={`tab-panel ${view === "sessions" ? "is-active" : ""}`}
          >
            <SectionTitle
              icon={<ShieldCheck size={18} />}
              title="Sessions"
              subtitle={`${sessions?.length ?? 0} recent`}
            />
            <SessionList
              sessions={sessions}
              selectedSessionId={activeSessionId}
              now={now}
              onSelect={setSelectedSessionId}
            />

            <SessionDetailsPanel
              details={details}
              now={now}
              busy={busy}
              onClose={handleClose}
              onDownload={() => details && downloadAttendancePdf(details)}
            />

            <ManualAddForm
              details={details}
              form={manualForm}
              busy={busy === "manual"}
              onChange={setManualForm}
              onSubmit={handleManualAdd}
            />
          </div>

          <div className={`tab-panel ${view === "people" ? "is-active" : ""}`}>
            <form className="compact-form" onSubmit={handleInvite}>
              <SectionTitle
                icon={<UserPlus size={18} />}
                title="Invite CR"
                subtitle="Same section only"
              />
              <div className="form-row single">
                <input
                  type="email"
                  placeholder="email@uttara.ac.bd"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
                <button
                  className="icon-button"
                  disabled={busy === "invite"}
                  type="submit"
                >
                  <Plus size={16} />
                </button>
              </div>
            </form>

            <RosterSummary roster={roster} />
          </div>
        </aside>
      </div>

      <AppToast toast={toast} onDismiss={() => setToast(null)} />

      <BottomNav<CrView>
        active={view}
        onChange={setView}
        tabs={[
          { id: "routine", label: "Routine", icon: <BookOpen size={20} /> },
          {
            id: "sessions",
            label: "Sessions",
            icon: <ShieldCheck size={20} />,
          },
          { id: "people", label: "People", icon: <Users size={20} /> },
        ]}
      />
    </>
  );
}

function ActiveAttendanceCard({
  session,
  now,
  submitted,
  pending,
  onSubmit,
}: {
  session: AttendanceSession;
  now: number;
  submitted: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  const disabled = submitted || pending || session.closesAt <= now;

  return (
    <article className="attendance-card active-session">
      <div className="card-topline">
        <span className="status-pill open">
          <Clock3 size={14} /> Open
        </span>
        <span className="muted">Closes {formatTime(session.closesAt)}</span>
      </div>
      <CourseHeading
        title={session.courseTitle}
        code={session.courseCode}
        as="h2"
      />
      <ClassMeta session={session} />
      <div className="card-actions">
        <button
          className="primary-action"
          type="button"
          disabled={disabled}
          onClick={onSubmit}
        >
          {submitted ? <CheckCircle2 size={18} /> : <CalendarCheck size={18} />}
          {submitted ? "Submitted" : pending ? "Submitting" : "I'm Present"}
        </button>
      </div>
    </article>
  );
}

function RoutineOpenCard({
  entry,
  busy,
  onOpen,
}: {
  entry: RoutineEntry;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="routine-open-card">
      <div className="card-topline">
        <span className="status-pill neutral">{entry.mode}</span>
        <span className="muted">{entry.day}</span>
      </div>
      <CourseHeading title={entry.courseTitle} code={entry.course} as="h3" />
      <div className="meta-grid">
        <span>
          <Clock3 size={14} /> {formatClockRange(entry.start, entry.end)}
        </span>
        <span>
          <Building2 size={14} /> {entry.room}
        </span>
        <span>
          <Users size={14} /> {entry.teacher || "Teacher TBA"}
        </span>
      </div>
      <button
        className="secondary-action"
        type="button"
        disabled={busy}
        onClick={onOpen}
      >
        <Play size={16} /> {busy ? "Opening" : "Open Attendance"}
      </button>
    </article>
  );
}

function SessionDetailsPanel({
  details,
  busy,
  now,
  onClose,
  onDownload,
}: {
  details: SessionDetails | undefined;
  busy: string;
  now: number;
  onClose: (sessionId: string) => void;
  onDownload: () => void;
}) {
  if (details === undefined) {
    return <PanelStatus label="Select a session" />;
  }

  const { session, records } = details;
  const isOpen = session.status === "open" && session.closesAt > now;

  return (
    <section className="detail-panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Selected</p>
          <CourseHeading
            title={session.courseTitle}
            code={session.courseCode}
            as="h3"
          />
        </div>
        <span className={`status-pill ${isOpen ? "open" : "closed"}`}>
          {isOpen ? <Clock3 size={14} /> : <Square size={14} />}
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>
      <ClassMeta session={session} />
      <div className="stats-row">
        <div>
          <strong>{records.length}</strong>
          <span>Present</span>
        </div>
        <div>
          <strong>
            {records.filter((record) => record.source === "manual").length}
          </strong>
          <span>Manual</span>
        </div>
      </div>
      <div className="card-actions split">
        <button className="secondary-action" type="button" onClick={onDownload}>
          <Download size={16} /> PDF
        </button>
        <button
          className="danger-action"
          type="button"
          disabled={!isOpen || busy === session._id}
          onClick={() => onClose(session._id)}
        >
          <Square size={16} /> Close
        </button>
      </div>
      <RecordTable records={records} />
    </section>
  );
}

function ManualAddForm({
  details,
  form,
  busy,
  onChange,
  onSubmit,
}: {
  details: SessionDetails | undefined;
  form: { fullName: string; email: string; reason: string };
  busy: boolean;
  onChange: (form: { fullName: string; email: string; reason: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!details) return null;

  return (
    <form className="compact-form" onSubmit={onSubmit}>
      <SectionTitle
        icon={<Plus size={18} />}
        title="Manual Add"
        subtitle="Reason required"
      />
      <div className="form-row two">
        <input
          value={form.fullName}
          onChange={(event) =>
            onChange({ ...form, fullName: event.target.value })
          }
          placeholder="Student name"
          required
        />
        <input
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
          type="email"
          placeholder="student@uttara.ac.bd"
          required
        />
      </div>
      <input
        value={form.reason}
        onChange={(event) => onChange({ ...form, reason: event.target.value })}
        placeholder="Reason"
        required
      />
      <button className="secondary-action full" type="submit" disabled={busy}>
        <Plus size={16} /> {busy ? "Adding" : "Add Present"}
      </button>
    </form>
  );
}

function SessionList({
  sessions,
  selectedSessionId,
  now,
  onSelect,
}: {
  sessions: AttendanceSession[] | undefined;
  selectedSessionId: string | null;
  now: number;
  onSelect: (id: string) => void;
}) {
  if (sessions === undefined) {
    return <PanelStatus label="Loading sessions" />;
  }
  if (sessions.length === 0) {
    return <p className="muted-block">No attendance sessions yet.</p>;
  }

  return (
    <div className="session-list">
      {sessions.map((session) => {
        const active = session.status === "open" && session.closesAt > now;
        return (
          <button
            key={session._id}
            className={selectedSessionId === session._id ? "selected" : ""}
            type="button"
            onClick={() => onSelect(session._id)}
          >
            <span>
              <strong>{session.courseTitle ?? session.courseCode}</strong>
              <small>
                {session.courseTitle ? `${session.courseCode} · ` : ""}
                {formatDateTime(session.openedAt)}
              </small>
            </span>
            <span className={`dot ${active ? "live" : ""}`} />
          </button>
        );
      })}
    </div>
  );
}

function RecordTable({ records }: { records: SessionDetails["records"] }) {
  if (records.length === 0) {
    return <p className="muted-block">No students marked present yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record._id}>
              <td>{record.studentId}</td>
              <td>{record.fullName}</td>
              <td>{record.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoutineList({
  entries,
  emptyText,
}: {
  entries: RoutineEntry[];
  emptyText: string;
}) {
  if (entries.length === 0) {
    return <p className="muted-block">{emptyText}</p>;
  }

  return (
    <div className="routine-list">
      {entries.map((entry) => (
        <div key={entry.id} className="routine-row">
          <span className="time-badge">{formatClockTime(entry.start)}</span>
          <div>
            <strong>{entry.courseTitle ?? entry.course}</strong>
            <small>
              {entry.courseTitle ? `${entry.course} · ` : ""}
              {entry.room} · {entry.teacher || "Teacher TBA"}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentList({
  records,
}: {
  records: RecentAttendanceRecord[] | undefined;
}) {
  if (records === undefined) {
    return <PanelStatus label="Loading recent" />;
  }
  if (records.length === 0) {
    return <p className="muted-block">No attendance submitted yet.</p>;
  }

  return (
    <div className="routine-list">
      {records.map(({ record, session }) => (
        <div key={record._id} className="routine-row">
          <span className="time-badge ok">
            <CheckCircle2 size={13} />
          </span>
          <div>
            <strong>
              {session?.courseTitle ?? session?.courseCode ?? "Class"}
            </strong>
            <small>
              {session?.courseTitle ? `${session.courseCode} · ` : ""}
              {formatDateTime(record.submittedAt)}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyAttendance({ nextClass }: { nextClass?: RoutineEntry }) {
  return (
    <article className="attendance-card quiet">
      <div className="empty-icon">
        <CalendarCheck size={24} />
      </div>
      <h2>No active attendance</h2>
      {nextClass ? (
        <p>
          Next class:{" "}
          <strong>{nextClass.courseTitle ?? nextClass.course}</strong>
          {nextClass.courseTitle ? ` (${nextClass.course})` : ""},{" "}
          {formatClockRange(nextClass.start, nextClass.end)}, {nextClass.room}.
        </p>
      ) : (
        <p>No remaining routine class is scheduled for today.</p>
      )}
    </article>
  );
}

function Onboarding({
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

function SignInScreen({
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

function BlockedEmail({
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

function SetupPreview({
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
  const sections = [
    ...new Set(entries.map((entry) => entry.batchLabel)),
  ].sort();

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

function AppHeader({
  profile,
  onSignOut,
  theme,
  onThemeToggle,
}: {
  profile: Profile;
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  const [showName, setShowName] = useState(false);

  useEffect(() => {
    if (!showName) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".profile-badge")) return;
      setShowName(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowName(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [showName]);

  return (
    <header className="app-header">
      <div className="app-title">
        <LogoMark small />
        <strong>UU Attendance</strong>
      </div>
      <div className="header-actions">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <div className="profile-chip">
          <div className="profile-badge">
            <button
              type="button"
              className="profile-avatar"
              aria-label={`Profile: ${profile.fullName}`}
              aria-expanded={showName}
              onClick={() => setShowName((value) => !value)}
            >
              {initials(profile.fullName)}
            </button>
            {showName ? (
              <div className="profile-tooltip" role="tooltip">
                <strong>{profile.fullName}</strong>
                <small>{profile.role === "cr" ? "CR" : "Student"}</small>
              </div>
            ) : null}
          </div>
          <div className="chip-text">
            <strong>{profile.fullName}</strong>
            <small>{profile.role === "cr" ? "CR" : "Student"}</small>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: T; label: string; icon: ReactNode }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav
      className="bottom-nav"
      aria-label="Section navigation"
      style={{ "--nav-count": tabs.length } as CSSProperties}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === active ? "active" : ""}
          aria-current={tab.id === active ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function CourseHeading({
  title,
  code,
  as,
}: {
  title?: string;
  code: string;
  as: "h2" | "h3";
}) {
  const Tag = as;
  if (!title) {
    return (
      <div className="course-heading">
        <Tag>{code}</Tag>
      </div>
    );
  }
  return (
    <div className="course-heading">
      <Tag>{title}</Tag>
      <span className="course-code">{code}</span>
    </div>
  );
}

function ClassMeta({ session }: { session: AttendanceSession }) {
  return (
    <div className="meta-grid">
      <span>
        <Clock3 size={14} />{" "}
        {formatClockRange(session.classStart, session.classEnd)}
      </span>
      <span>
        <Building2 size={14} /> {session.room || "Not assigned"}
      </span>
      <span>
        <Users size={14} /> {session.teacher || "Teacher TBA"}
      </span>
      <span>
        {session.mode === "Online" ? (
          <Wifi size={14} />
        ) : (
          <Building2 size={14} />
        )}{" "}
        {session.mode}
      </span>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-title">
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function RosterSummary({ roster }: { roster: Profile[] | undefined }) {
  if (roster === undefined) {
    return <PanelStatus label="Loading people" />;
  }

  const people = [...roster].sort((a, b) => {
    if (a.role !== b.role) return a.role === "cr" ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });
  const countLabel =
    roster.length === 1 ? "1 person" : `${roster.length} people`;

  return (
    <section className="roster-summary">
      <SectionTitle
        icon={<Users size={18} />}
        title="Section People"
        subtitle={`${countLabel} - CR view only`}
      />
      <div className="roster-list">
        {people.map((person) => (
          <div key={person._id} className="roster-person">
            <span className="roster-avatar">{initials(person.fullName)}</span>
            <div className="roster-person-main">
              <strong>{person.fullName}</strong>
              <small>ID {person.studentId}</small>
            </div>
            <small className={`person-role ${person.role}`}>
              {person.role === "cr" ? "CR" : "Student"}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "brand-mark app-logo-mark small" : "brand-mark app-logo-mark"}>
      <img src="/app-logo.svg" alt="" aria-hidden="true" />
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function AppToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(
      onDismiss,
      toast.kind === "error" ? 6500 : 3600,
    );
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const icon =
    toast.kind === "success" ? (
      <CheckCircle2 size={18} />
    ) : (
      <AlertCircle size={18} />
    );

  return (
    <div
      className="toast-region"
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div
        key={toast.id}
        className={`app-toast ${toast.kind}`}
        role={toast.kind === "error" ? "alert" : "status"}
      >
        <span className="toast-icon">{icon}</span>
        <div>
          <strong>{toast.title}</strong>
          {toast.message ? <p>{toast.message}</p> : null}
        </div>
        <button
          className="toast-close"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosInstall, setIosInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined" || dismissed) return;

    const mobileQuery = window.matchMedia("(max-width: 720px), (pointer: coarse)");

    function syncVisibility() {
      const mobile = mobileQuery.matches;
      const standalone = isStandalonePwa();
      const ios = isAppleMobileDevice();

      setIosInstall(ios);
      setVisible(!standalone && mobile && (ios || promptEvent !== null));
    }

    syncVisibility();
    mobileQuery.addEventListener("change", syncVisibility);

    return () => mobileQuery.removeEventListener("change", syncVisibility);
  }, [dismissed, promptEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setPromptEvent(null);
      setVisible(false);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!promptEvent) return;

    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
    setVisible(false);
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  }

  if (!visible) return null;

  return (
    <aside className="install-prompt" aria-label="Install app">
      <span className="install-prompt-icon">
        <Smartphone size={18} />
      </span>
      <div className="install-prompt-copy">
        <strong>Install UU Attendance</strong>
        <p>
          {iosInstall
            ? "Tap Share, then Add to Home Screen."
            : "Save it to your phone for faster attendance."}
        </p>
      </div>
      {promptEvent ? (
        <button className="install-action" type="button" onClick={handleInstall}>
          <Download size={15} /> Install
        </button>
      ) : (
        <span className="install-hint">Share &gt; Add</span>
      )}
      <button
        className="toast-close install-close"
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
      >
        <X size={14} />
      </button>
    </aside>
  );
}

function InlineNotice({ text }: { text: string }) {
  return (
    <div className="notice">
      <AlertCircle size={16} /> {text}
    </div>
  );
}

function PanelStatus({ label }: { label: string }) {
  return (
    <p className="panel-status">
      <RefreshCw size={14} /> {label}
    </p>
  );
}

function FullPageStatus({ label }: { label: string }) {
  return (
    <div className="auth-shell">
      <p className="panel-status large">
        <RefreshCw size={16} /> {label}
      </p>
    </div>
  );
}

function isStandalonePwa() {
  const standaloneNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  );
}

function isAppleMobileDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const iPadOS =
    userAgent.includes("macintosh") && window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || iPadOS;
}

function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = window.localStorage.getItem("uu-attendance-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("uu-attendance-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return [theme, toggleTheme] as const;
}

function useRoutineData() {
  const [routineData, setRoutineData] = useState<RoutineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    loadRoutineData()
      .then((data) => {
        if (mounted) setRoutineData(data);
      })
      .catch((error) => {
        if (mounted) setError(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { routineData, loading, error };
}

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "UU"
  );
}

function createToast(
  kind: ToastKind,
  title: string,
  message?: string,
): ToastState {
  return {
    id: Date.now() + Math.random(),
    kind,
    title,
    message,
  };
}

function createErrorToast(error: unknown, fallbackTitle: string): ToastState {
  const message = errorMessage(error);

  if (/attendance session is already open/i.test(message)) {
    return createToast(
      "error",
      "Attendance already open",
      "Close the current open session before starting a new one.",
    );
  }

  return createToast("error", fallbackTitle, message);
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return cleanErrorMessage(raw);
}

function cleanErrorMessage(raw: string) {
  let message = raw.replace(/\s+/g, " ").trim();
  const uncaught = message.match(
    /Uncaught Error:\s*(.*?)(?:\s+at\s+\w+|\s+Called by client|$)/,
  );

  if (uncaught?.[1]) {
    message = uncaught[1];
  } else {
    const serverError = message.match(
      /Server Error\s*(.*?)(?:\s+Called by client|$)/,
    );
    if (serverError?.[1]) {
      message = serverError[1];
    }
  }

  message = message
    .replace(/^\[CONVEX[^\]]+\]\s*/, "")
    .replace(/^\[Request ID:[^\]]+\]\s*/, "")
    .replace(/^Server Error\s*/, "")
    .replace(/^Uncaught Error:\s*/, "")
    .replace(/^Error:\s*/, "")
    .trim();

  return message || "Something went wrong. Please try again.";
}

export default App;
