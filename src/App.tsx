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
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Timer,
  User,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";
import {
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

function App({ backendReady }: { backendReady: boolean }) {
  const { routineData, loading, error } = useRoutineData();
  const entries = useMemo(
    () => normalizeRoutineEntries(routineData?.entries ?? []),
    [routineData],
  );

  if (!backendReady) {
    return <SetupPreview entries={entries} loading={loading} error={error} />;
  }

  return <AuthenticatedApp entries={entries} routineLoading={loading} />;
}

function AuthenticatedApp({
  entries,
  routineLoading,
}: {
  entries: RoutineEntry[];
  routineLoading: boolean;
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
      />
    );
  }

  if (current === undefined) {
    return <FullPageStatus label="Checking account" />;
  }

  if (!current?.isAllowedEmail) {
    return <BlockedEmail current={current} onSignOut={signOut} />;
  }

  if (!current.profile) {
    return (
      <Onboarding current={current} entries={entries} onSignOut={signOut} />
    );
  }

  const profile = current.profile;
  const isCr = profile.role === "cr";

  return (
    <div className="app-shell">
      <AppHeader profile={profile} onSignOut={signOut} />

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
  const [message, setMessage] = useState("");
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
    setMessage("");
    try {
      await submitAttendance({ sessionId });
      setMessage("Attendance submitted.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPendingSession(null);
    }
  }

  return (
    <div className="student-layout">
      <section className="section-main">
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

        {message ? <InlineNotice text={message} /> : null}
      </section>

      <aside className="side-panel">
        <SectionTitle
          icon={<BookOpen size={18} />}
          title="Today"
          subtitle={getDayName()}
        />
        <RoutineList
          entries={todayRoutine}
          emptyText="No routine classes today."
        />

        <SectionTitle
          icon={<FileText size={18} />}
          title="Recent"
          subtitle="Your submissions"
        />
        <RecentList records={recentRecords} />
      </aside>
    </div>
  );
}

function CrDashboard({
  profile,
  entries,
}: {
  profile: Profile;
  entries: RoutineEntry[];
}) {
  const now = useNow();
  const todayRoutine = getTodayRoutine(entries, profile.batch, profile.section);
  const sectionRoutine = entries
    .filter(
      (entry) =>
        entry.batch === profile.batch && entry.section === profile.section,
    )
    .sort(
      (a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start),
    );
  const routineForOpening =
    todayRoutine.length > 0 ? todayRoutine : sectionRoutine.slice(0, 10);
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
  const [notice, setNotice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
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
    setNotice("");
    try {
      const routine = {
        id: entry.id,
        batch: entry.batch,
        section: entry.section,
        course: entry.course,
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
      setNotice("Attendance opened.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function handleClose(sessionId: string) {
    setBusy(sessionId);
    setNotice("");
    try {
      await closeSession({ sessionId });
      setNotice("Attendance closed.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("invite");
    setNotice("");
    try {
      await inviteCr({
        email: inviteEmail,
        batch: profile.batch,
        section: profile.section,
      });
      setInviteEmail("");
      setNotice("CR invite saved.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details?.session) return;

    setBusy("manual");
    setNotice("");
    try {
      await manualMarkPresent({
        sessionId: details.session._id,
        ...manualForm,
      });
      setManualForm({ fullName: "", email: "", reason: "" });
      setNotice("Manual attendance added.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="cr-layout">
      <section className="section-main">
        <div className="section-heading-row">
          <SectionTitle
            icon={<BookOpen size={18} />}
            title={
              todayRoutine.length > 0 ? "Today's Routine" : "Section Routine"
            }
            subtitle={`Batch ${profile.batch}, Section ${profile.section}`}
          />
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

        {notice ? <InlineNotice text={notice} /> : null}
      </section>

      <aside className="side-panel cr-side">
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
      </aside>
    </div>
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
      <h2>{session.courseCode}</h2>
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
      <h3>{entry.course}</h3>
      <div className="meta-grid">
        <span>
          <Clock3 size={14} /> {entry.start} - {entry.end}
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
          <h3>{session.courseCode}</h3>
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
  onChange: (form: {
    fullName: string;
    email: string;
    reason: string;
  }) => void;
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
              <strong>{session.courseCode}</strong>
              <small>{formatDateTime(session.openedAt)}</small>
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
          <span className="time-badge">{entry.start}</span>
          <div>
            <strong>{entry.course}</strong>
            <small>
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
            <strong>{session?.courseCode ?? "Class"}</strong>
            <small>{formatDateTime(record.submittedAt)}</small>
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
          Next class: <strong>{nextClass.course}</strong>, {nextClass.start} -{" "}
          {nextClass.end}, {nextClass.room}.
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
}: {
  current: CurrentUserResult;
  entries: RoutineEntry[];
  onSignOut: () => Promise<void>;
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
        <div className="brand-mark">
          <CalendarCheck size={28} />
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
}: {
  entries: RoutineEntry[];
  error: string;
  onLogin: (payload: LoginPayload) => Promise<void>;
  onSignup: (payload: SignupPayload) => Promise<void>;
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
          <div className="brand-mark">
            <CalendarCheck size={26} />
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
}: {
  current: CurrentUserResult | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="brand-mark danger">
          <AlertCircle size={28} />
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
}: {
  entries: RoutineEntry[];
  loading: boolean;
  error: string;
}) {
  const sections = [
    ...new Set(entries.map((entry) => entry.batchLabel)),
  ].sort();

  return (
    <div className="auth-shell setup">
      <div className="auth-panel wide">
        <div className="brand-mark">
          <CalendarCheck size={28} />
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
}: {
  profile: Profile;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="app-header">
      <div className="app-title">
        <div className="brand-mark small">
          <CalendarCheck size={20} />
        </div>
        <div>
          <strong>UU Attendance</strong>
          <span>
            Batch {profile.batch}, Section {profile.section}
          </span>
        </div>
      </div>
      <div className="profile-chip">
        <span>{initials(profile.fullName)}</span>
        <div>
          <strong>{profile.fullName}</strong>
          <small>{profile.role === "cr" ? "CR" : "Student"}</small>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onSignOut}
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function ClassMeta({ session }: { session: AttendanceSession }) {
  return (
    <div className="meta-grid">
      <span>
        <Clock3 size={14} /> {session.classStart} - {session.classEnd}
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
    return <PanelStatus label="Loading roster" />;
  }

  return (
    <section className="roster-summary">
      <SectionTitle
        icon={<Users size={18} />}
        title="Roster"
        subtitle={`${roster.length} profiles`}
      />
      <div className="roster-list">
        {roster.slice(0, 6).map((person) => (
          <div key={person._id}>
            <span>{initials(person.fullName)}</span>
            <div>
              <strong>{person.fullName}</strong>
              <small>{person.studentId}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default App;
