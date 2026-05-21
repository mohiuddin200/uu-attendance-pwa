import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Building2,
  Clock3,
  Download,
  Lock,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Square,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { AppToast } from "../../components/AppToast";
import {
  BottomNav,
  ClassMeta,
  CourseHeading,
  PanelStatus,
  SectionTitle,
} from "../../components/ui";
import { useNow } from "../../hooks/useNow";
import { api } from "../../lib/api";
import type { ToastState } from "../../lib/appTypes";
import { createErrorToast, createToast } from "../../lib/errors";
import { initials } from "../../lib/text";
import {
  formatClockRange,
  formatDateTime,
  getDayName,
} from "../../lib/routine";
import type {
  AttendanceSession,
  Profile,
  RoutineEntry,
  SessionDetails,
} from "../../types";

type CrView = "routine" | "sessions" | "people";
type SessionStatusFilter = "all" | "open" | "closed";

const SESSION_PAGE_SIZE = 12;

const WEEK_ORDER: string[] = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export function CrDashboard({
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
  const [sessionLimit, setSessionLimit] = useState(SESSION_PAGE_SIZE);
  const sessions = useQuery(api.attendance.sessionsForCr, {
    limit: sessionLimit,
  });
  const loadedSessions = useMemo(() => sessions ?? [], [sessions]);
  const sessionsStatus = sessions
    ? loadedSessions.length >= sessionLimit
      ? "CanLoadMore"
      : "Exhausted"
    : sessionLimit > SESSION_PAGE_SIZE
      ? "LoadingMore"
      : "LoadingFirstPage";
  const roster = useQuery(api.profiles.listSectionPeople, {});
  const openSession = useMutation(api.attendance.openSession);
  const closeSession = useMutation(api.attendance.closeSession);
  const inviteCr = useMutation(api.profiles.inviteCr);
  const manualMarkPresent = useMutation(api.attendance.manualMarkPresent);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [sessionStatusFilter, setSessionStatusFilter] =
    useState<SessionStatusFilter>("all");
  const [sessionSearch, setSessionSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [view, setView] = useState<CrView>("routine");
  const [manualForm, setManualForm] = useState({
    fullName: "",
    email: "",
    reason: "",
  });
  const activeSessionId = selectedSessionId ?? loadedSessions[0]?._id ?? null;
  const details = useQuery(
    api.attendance.sessionDetails,
    activeSessionId ? { sessionId: activeSessionId } : "skip",
  );
  const filteredSessions = useMemo(
    () =>
      loadedSessions.filter((session) =>
        sessionMatchesFilters(
          session,
          sessionStatusFilter,
          sessionSearch,
          now,
        ),
      ),
    [loadedSessions, now, sessionSearch, sessionStatusFilter],
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

  async function handleDownload() {
    if (!details) return;

    setPdfBusy(true);
    setToast(null);
    try {
      const { downloadAttendancePdf } = await import("../../lib/pdf");
      await downloadAttendancePdf(details);
    } catch (error) {
      setToast(createErrorToast(error, "Could not export PDF"));
    } finally {
      setPdfBusy(false);
    }
  }

  const selectedSessionContent = (
    <>
      <SessionDetailsPanel
        details={details}
        now={now}
        busy={busy}
        pdfBusy={pdfBusy}
        onClose={handleClose}
        onDownload={handleDownload}
      />

      <ManualAddForm
        details={details}
        form={manualForm}
        busy={busy === "manual"}
        onChange={setManualForm}
        onSubmit={handleManualAdd}
      />
    </>
  );

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
              subtitle={`${loadedSessions.length} loaded`}
            />
            <SessionFilters
              statusFilter={sessionStatusFilter}
              search={sessionSearch}
              onStatusFilterChange={setSessionStatusFilter}
              onSearchChange={setSessionSearch}
            />
            <SessionList
              sessions={filteredSessions}
              hasAnySessions={loadedSessions.length > 0}
              loading={sessionsStatus === "LoadingFirstPage"}
              selectedSessionId={activeSessionId}
              now={now}
              onSelect={setSelectedSessionId}
              selectedContent={selectedSessionContent}
            />
            <SessionLoadMore
              status={sessionsStatus}
              onLoadMore={() =>
                setSessionLimit((current) => current + SESSION_PAGE_SIZE)
              }
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
  pdfBusy,
  now,
  onClose,
  onDownload,
}: {
  details: SessionDetails | undefined;
  busy: string;
  pdfBusy: boolean;
  now: number;
  onClose: (sessionId: string) => void;
  onDownload: () => void;
}) {
  if (details === undefined) {
    return <PanelStatus label="Loading session" />;
  }

  const { session, records } = details;
  const isOpen = isSessionActive(session, now);

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
        <button
          className="secondary-action"
          type="button"
          disabled={pdfBusy}
          onClick={onDownload}
        >
          <Download size={16} /> {pdfBusy ? "Generating" : "PDF"}
        </button>
        <button
          className="danger-action"
          type="button"
          disabled={!isOpen || busy === session._id}
          onClick={() => onClose(session._id)}
        >
          <Lock size={16} /> Close
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
    <form className="compact-form manual-add-form" onSubmit={onSubmit}>
      <div className="manual-add-header">
        <SectionTitle
          icon={<Plus size={18} />}
          title="Manual Add"
          subtitle="Reason required"
        />
        <button
          className="primary-action manual-add-submit"
          type="submit"
          disabled={busy}
        >
          <Plus size={16} /> {busy ? "Adding" : "Add Present"}
        </button>
      </div>
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
    </form>
  );
}

function SessionFilters({
  statusFilter,
  search,
  onStatusFilterChange,
  onSearchChange,
}: {
  statusFilter: SessionStatusFilter;
  search: string;
  onStatusFilterChange: (status: SessionStatusFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  const filters: ReadonlyArray<{ id: SessionStatusFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className="session-tools">
      <div className="session-filter-tabs" aria-label="Session status filter">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={statusFilter === filter.id ? "active" : ""}
            type="button"
            onClick={() => onStatusFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <label className="session-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search course, teacher, room"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function SessionList({
  sessions,
  hasAnySessions,
  loading,
  selectedSessionId,
  now,
  onSelect,
  selectedContent,
}: {
  sessions: AttendanceSession[];
  hasAnySessions: boolean;
  loading: boolean;
  selectedSessionId: string | null;
  now: number;
  onSelect: (id: string) => void;
  selectedContent: ReactNode;
}) {
  if (loading) {
    return <PanelStatus label="Loading sessions" />;
  }
  if (!hasAnySessions) {
    return <p className="muted-block">No attendance sessions yet.</p>;
  }
  if (sessions.length === 0) {
    return <p className="muted-block">No sessions match these filters.</p>;
  }

  const openSessions = sessions.filter((session) => isSessionActive(session, now));
  const recentSessions = sessions.filter(
    (session) => !isSessionActive(session, now),
  );

  return (
    <div className="session-groups">
      {openSessions.length > 0 ? (
        <SessionGroup
          title="Open now"
          sessions={openSessions}
          selectedSessionId={selectedSessionId}
          now={now}
          onSelect={onSelect}
          selectedContent={selectedContent}
        />
      ) : null}
      {recentSessions.length > 0 ? (
        <SessionGroup
          title="Recent"
          sessions={recentSessions}
          selectedSessionId={selectedSessionId}
          now={now}
          onSelect={onSelect}
          selectedContent={selectedContent}
        />
      ) : null}
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  selectedSessionId,
  now,
  onSelect,
  selectedContent,
}: {
  title: string;
  sessions: AttendanceSession[];
  selectedSessionId: string | null;
  now: number;
  onSelect: (id: string) => void;
  selectedContent: ReactNode;
}) {
  return (
    <section className="session-group">
      <div className="session-group-title">
        <span>{title}</span>
        <small>{sessions.length}</small>
      </div>
      <div className="session-list">
        {sessions.map((session) => {
          const selected = selectedSessionId === session._id;

          return (
            <div className="session-list-item" key={session._id}>
              <SessionRow
                session={session}
                selected={selected}
                now={now}
                onSelect={() => onSelect(session._id)}
              />
              {selected ? (
                <div className="session-selection-panel">
                  {selectedContent}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SessionRow({
  session,
  selected,
  now,
  onSelect,
}: {
  session: AttendanceSession;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const active = isSessionActive(session, now);

  return (
    <button
      className={selected ? "selected" : ""}
      type="button"
      aria-expanded={selected}
      onClick={onSelect}
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
}

function SessionLoadMore({
  status,
  onLoadMore,
}: {
  status: string;
  onLoadMore: () => void;
}) {
  if (status === "CanLoadMore") {
    return (
      <button
        className="secondary-action full session-load-more"
        type="button"
        onClick={onLoadMore}
      >
        Load older
      </button>
    );
  }
  if (status === "LoadingMore") {
    return <PanelStatus label="Loading older sessions" />;
  }

  return null;
}

function sessionMatchesFilters(
  session: AttendanceSession,
  statusFilter: SessionStatusFilter,
  search: string,
  now: number,
) {
  const active = isSessionActive(session, now);
  if (statusFilter === "open" && !active) return false;
  if (statusFilter === "closed" && active) return false;

  const query = search.trim().toLowerCase();
  if (!query) return true;

  return sessionSearchText(session).includes(query);
}

function sessionSearchText(session: AttendanceSession) {
  return [
    session.courseCode,
    session.courseTitle ?? "",
    session.teacher,
    session.room,
    session.day,
    formatDateTime(session.openedAt),
  ]
    .join(" ")
    .toLowerCase();
}

function isSessionActive(session: AttendanceSession, now: number) {
  return session.status === "open" && session.closesAt > now;
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
