import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
} from "lucide-react";
import { useState } from "react";
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
import {
  formatClockRange,
  formatClockTime,
  formatDateTime,
  formatTime,
  getDayName,
  getNextClass,
  getTodayRoutine,
} from "../../lib/routine";
import type {
  AttendanceSession,
  Profile,
  RecentAttendanceRecord,
  RoutineEntry,
} from "../../types";

type StudentView = "attend" | "today" | "recent";

export function StudentDashboard({
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
