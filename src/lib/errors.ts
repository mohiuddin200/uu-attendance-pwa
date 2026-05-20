import type { ToastKind, ToastState } from "./appTypes";

export function createToast(
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

export function createErrorToast(
  error: unknown,
  fallbackTitle: string,
): ToastState {
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

export function errorMessage(error: unknown) {
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
