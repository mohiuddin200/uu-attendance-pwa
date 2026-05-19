import type { RoutineData, RoutineEntry, RoutineEntryRaw } from "../types";
import { getCourseTitle } from "./course-titles";

const ROUTINE_SCRIPT_ID = "uu-routine-data";
const TIME_ZONE = "Asia/Dhaka";

declare global {
  interface Window {
    ROUTINE_DATA?: RoutineData;
  }
}

export function loadRoutineData() {
  if (window.ROUTINE_DATA) {
    return Promise.resolve(window.ROUTINE_DATA);
  }

  return new Promise<RoutineData>((resolve, reject) => {
    const existingScript = document.getElementById(ROUTINE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.ROUTINE_DATA) resolve(window.ROUTINE_DATA);
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Routine data could not be loaded.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = ROUTINE_SCRIPT_ID;
    script.src = "/data/routine-data.js";
    script.async = true;
    script.onload = () => {
      if (!window.ROUTINE_DATA) {
        reject(new Error("Routine data was empty."));
        return;
      }
      resolve(window.ROUTINE_DATA);
    };
    script.onerror = () =>
      reject(new Error("Routine data could not be loaded."));
    document.head.append(script);
  });
}

export function normalizeRoutineEntries(
  entries: RoutineEntryRaw[],
): RoutineEntry[] {
  return entries
    .map((entry): RoutineEntry | null => {
      const match = entry.batch.match(/^(\d+)\s+([A-Z])$/);
      if (!match) return null;

      return {
        id: entry.id,
        batch: match[1],
        section: match[2],
        batchLabel: entry.batch,
        day: entry.day,
        start: entry.start,
        end: entry.end,
        course: entry.course,
        courseTitle: getCourseTitle(entry.course),
        teacher: entry.teacher,
        room: entry.room || "Not assigned",
        mode: entry.mode,
        program: entry.program,
        slot: entry.slot,
      };
    })
    .filter((entry): entry is RoutineEntry => entry !== null);
}

export function getDayName(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(timestamp));
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(timestamp));
}

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatClockTime(value: string) {
  const [hoursRaw, minutes] = value.split(":");
  const hours = Number(hoursRaw);
  if (Number.isNaN(hours)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 || 12;
  return `${display}:${minutes ?? "00"} ${period}`;
}

export function formatClockRange(start: string, end: string) {
  return `${formatClockTime(start)} - ${formatClockTime(end)}`;
}

export function getCurrentDhakaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

export function getTodayRoutine(
  entries: RoutineEntry[],
  batch: string,
  section: string,
) {
  const today = getDayName();
  return entries
    .filter(
      (entry) =>
        entry.batch === batch &&
        entry.section === section &&
        entry.day === today,
    )
    .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start));
}

export function getNextClass(
  entries: RoutineEntry[],
  batch: string,
  section: string,
) {
  const today = getDayName();
  const now = getCurrentDhakaMinutes();

  return entries
    .filter(
      (entry) =>
        entry.batch === batch &&
        entry.section === section &&
        entry.day === today &&
        minutesFromTime(entry.end) >= now,
    )
    .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start))[0];
}

export function uniqueBatches(entries: RoutineEntry[]) {
  return [...new Set(entries.map((entry) => entry.batch))].sort();
}

export function uniqueSections(entries: RoutineEntry[], batch: string) {
  return [
    ...new Set(
      entries
        .filter((entry) => entry.batch === batch)
        .map((entry) => entry.section),
    ),
  ].sort();
}
