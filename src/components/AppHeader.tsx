import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type { ThemeMode } from "../lib/appTypes";
import { initials } from "../lib/text";
import type { Profile } from "../types";
import { LogoMark, ThemeToggle } from "./ui";

export function AppHeader({
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
