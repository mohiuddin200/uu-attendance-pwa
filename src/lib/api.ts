import { makeFunctionReference } from "convex/server";
import type {
  AttendanceRecord,
  AttendanceSession,
  CurrentUserResult,
  Profile,
  RecentAttendanceRecord,
  RoutineEntry,
  SessionDetails,
} from "../types";

export const api = {
  profiles: {
    current: makeFunctionReference<
      "query",
      Record<string, never>,
      CurrentUserResult | null
    >("profiles:current"),
    completeProfile: makeFunctionReference<
      "mutation",
      {
        fullName: string;
        batch: string;
        section: string;
      },
      Profile
    >("profiles:completeProfile"),
    syncInitialCrRole: makeFunctionReference<
      "mutation",
      Record<string, never>,
      Profile | null
    >("profiles:syncInitialCrRole"),
    inviteCr: makeFunctionReference<
      "mutation",
      { email: string; batch: string; section: string },
      { ok: true }
    >("profiles:inviteCr"),
    listSectionPeople: makeFunctionReference<
      "query",
      Record<string, never>,
      Profile[]
    >("profiles:listSectionPeople"),
  },
  attendance: {
    openSession: makeFunctionReference<
      "mutation",
      {
        routine: Omit<RoutineEntry, "batchLabel" | "slot">;
        durationMinutes: number;
      },
      AttendanceSession
    >("attendance:openSession"),
    activeForMe: makeFunctionReference<
      "query",
      Record<string, never>,
      AttendanceSession[]
    >("attendance:activeForMe"),
    submit: makeFunctionReference<
      "mutation",
      { sessionId: string },
      AttendanceRecord
    >("attendance:submit"),
    myRecentRecords: makeFunctionReference<
      "query",
      { limit?: number },
      RecentAttendanceRecord[]
    >("attendance:myRecentRecords"),
    sessionsForCr: makeFunctionReference<
      "query",
      { limit?: number },
      AttendanceSession[]
    >("attendance:sessionsForCr"),
    sessionDetails: makeFunctionReference<
      "query",
      { sessionId: string },
      SessionDetails
    >("attendance:sessionDetails"),
    closeSession: makeFunctionReference<
      "mutation",
      { sessionId: string },
      { ok: true }
    >("attendance:closeSession"),
    manualMarkPresent: makeFunctionReference<
      "mutation",
      {
        sessionId: string;
        fullName: string;
        email: string;
        reason: string;
      },
      AttendanceRecord
    >("attendance:manualMarkPresent"),
  },
};
