import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "uu-attendance-install-dismissed";

export function PwaInstallPrompt() {
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

    const mobileQuery = window.matchMedia(
      "(max-width: 720px), (pointer: coarse)",
    );

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
