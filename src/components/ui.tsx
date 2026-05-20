import {
  AlertCircle,
  Building2,
  Clock3,
  Moon,
  RefreshCw,
  Sun,
  Users,
  Wifi,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { ThemeMode } from "../lib/appTypes";
import { formatClockRange } from "../lib/routine";
import type { AttendanceSession } from "../types";

export function BottomNav<T extends string>({
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

export function CourseHeading({
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

export function ClassMeta({ session }: { session: AttendanceSession }) {
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

export function SectionTitle({
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

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={
        small ? "brand-mark app-logo-mark small" : "brand-mark app-logo-mark"
      }
    >
      <img src="/app-logo.svg" alt="" aria-hidden="true" />
    </div>
  );
}

export function ThemeToggle({
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

export function InlineNotice({ text }: { text: string }) {
  return (
    <div className="notice">
      <AlertCircle size={16} /> {text}
    </div>
  );
}

export function PanelStatus({ label }: { label: string }) {
  return (
    <p className="panel-status">
      <RefreshCw size={14} /> {label}
    </p>
  );
}

export function FullPageStatus({ label }: { label: string }) {
  return (
    <div className="auth-shell">
      <p className="panel-status large">
        <RefreshCw size={16} /> {label}
      </p>
    </div>
  );
}
