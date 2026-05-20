import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import {
  UNIVERSITY_DOMAIN,
  isUniversityEmail,
  normalizeEmail,
  studentIdFromEmail,
} from "./lib/appRules";

type AppCtx = QueryCtx | MutationCtx;
type ProfileRole = "student" | "cr";
type ActiveProfile = {
  userId: Id<"users">;
  email: string;
  fullName: string;
  studentId: string;
  batch: string;
  section: string;
  role: ProfileRole;
  status: "active" | "blocked";
};

async function profileByUserId(ctx: AppCtx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function profileByEmail(ctx: AppCtx, email: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .unique();
}

async function currentProfile(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Please sign in first.");
  }

  const profile = await profileByUserId(ctx, userId);
  if (!profile || profile.status !== "active") {
    throw new Error("Complete your profile before using attendance.");
  }

  return { userId, profile: profile as ActiveProfile };
}

function assertCr(profile: ActiveProfile) {
  if (profile.role !== "cr") {
    throw new Error("Only CRs can perform this action.");
  }
}

const routineInput = v.object({
  id: v.string(),
  batch: v.string(),
  section: v.string(),
  course: v.string(),
  courseTitle: v.optional(v.string()),
  teacher: v.string(),
  room: v.string(),
  mode: v.string(),
  program: v.string(),
  day: v.string(),
  start: v.string(),
  end: v.string(),
});

export const openSession = mutation({
  args: {
    routine: routineInput,
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await currentProfile(ctx);
    assertCr(profile);

    const durationMinutes = Math.max(1, Math.min(120, args.durationMinutes));
    const routine = args.routine;
    if (
      routine.batch !== profile.batch ||
      routine.section !== profile.section
    ) {
      throw new Error("You can open attendance only for your own section.");
    }

    const now = Date.now();
    const openSessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_batch_section_status", (q) =>
        q
          .eq("batch", profile.batch)
          .eq("section", profile.section)
          .eq("status", "open"),
      )
      .collect();

    for (const session of openSessions) {
      if (session.closesAt > now) {
        throw new Error(
          "An attendance session is already open for this section.",
        );
      }
      await ctx.db.patch(session._id, {
        status: "closed",
        closedAt: session.closesAt,
      });
    }

    const sessionId = await ctx.db.insert("attendanceSessions", {
      routineEntryId: routine.id,
      batch: routine.batch,
      section: routine.section,
      courseCode: routine.course,
      courseTitle: routine.courseTitle,
      teacher: routine.teacher,
      room: routine.room,
      mode: routine.mode,
      program: routine.program,
      day: routine.day,
      classStart: routine.start,
      classEnd: routine.end,
      openedBy: userId,
      openedAt: now,
      closesAt: now + durationMinutes * 60 * 1000,
      status: "open",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "attendance.opened",
      target: sessionId,
      metadata: {
        courseCode: routine.course,
        batch: routine.batch,
        section: routine.section,
        durationMinutes,
      },
      createdAt: now,
    });

    return await ctx.db.get(sessionId);
  },
});

export const activeForMe = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await currentProfile(ctx);
    const now = Date.now();

    const sessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_batch_section_status", (q) =>
        q
          .eq("batch", profile.batch)
          .eq("section", profile.section)
          .eq("status", "open"),
      )
      .collect();

    return sessions.filter((session) => session.closesAt > now);
  },
});

export const submit = mutation({
  args: {
    sessionId: v.id("attendanceSessions"),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await currentProfile(ctx);
    const session = await ctx.db.get(args.sessionId);
    const now = Date.now();

    if (!session || session.status !== "open" || session.closesAt <= now) {
      throw new Error("Attendance is closed for this class.");
    }
    if (
      session.batch !== profile.batch ||
      session.section !== profile.section
    ) {
      throw new Error("This attendance is not for your section.");
    }

    const existing = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", userId),
      )
      .unique();

    if (existing) {
      return existing;
    }

    const recordId = await ctx.db.insert("attendanceRecords", {
      sessionId: args.sessionId,
      userId,
      email: profile.email,
      fullName: profile.fullName,
      studentId: profile.studentId,
      batch: profile.batch,
      section: profile.section,
      status: "present",
      source: "student",
      submittedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "attendance.submitted",
      target: args.sessionId,
      metadata: { recordId },
      createdAt: now,
    });

    return await ctx.db.get(recordId);
  },
});

export const myRecentRecords = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await currentProfile(ctx);
    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const sorted = records
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, args.limit ?? 8);

    return await Promise.all(
      sorted.map(async (record) => ({
        record,
        session: await ctx.db.get(record.sessionId),
      })),
    );
  },
});

export const sessionsForCr = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await currentProfile(ctx);
    assertCr(profile);

    return await ctx.db
      .query("attendanceSessions")
      .withIndex("by_batch_section_opened", (q) =>
        q.eq("batch", profile.batch).eq("section", profile.section),
      )
      .order("desc")
      .take(args.limit ?? 12);
  },
});

export const sessionDetails = query({
  args: {
    sessionId: v.id("attendanceSessions"),
  },
  handler: async (ctx, args) => {
    const { profile } = await currentProfile(ctx);
    assertCr(profile);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Attendance session not found.");
    }
    if (
      session.batch !== profile.batch ||
      session.section !== profile.section
    ) {
      throw new Error("You can view only your own section.");
    }

    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      session,
      records: records.sort((a, b) => a.studentId.localeCompare(b.studentId)),
    };
  },
});

export const closeSession = mutation({
  args: {
    sessionId: v.id("attendanceSessions"),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await currentProfile(ctx);
    assertCr(profile);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Attendance session not found.");
    }
    if (
      session.batch !== profile.batch ||
      session.section !== profile.section
    ) {
      throw new Error("You can close only your own section.");
    }

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: "closed",
      closedAt: now,
      closesAt: Math.min(session.closesAt, now),
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "attendance.closed",
      target: args.sessionId,
      createdAt: now,
    });

    return { ok: true };
  },
});

export const manualMarkPresent = mutation({
  args: {
    sessionId: v.id("attendanceSessions"),
    fullName: v.string(),
    email: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await currentProfile(ctx);
    assertCr(profile);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Attendance session not found.");
    }
    if (
      session.batch !== profile.batch ||
      session.section !== profile.section
    ) {
      throw new Error("You can edit only your own section.");
    }

    const email = normalizeEmail(args.email);
    if (!isUniversityEmail(email)) {
      throw new Error(
        `Manual attendance requires an @${UNIVERSITY_DOMAIN} email.`,
      );
    }

    const studentId = studentIdFromEmail(email, "the");
    const reason = args.reason.trim();
    if (reason.length < 4) {
      throw new Error("Add a clear reason for manual attendance.");
    }

    const existing = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_session_email", (q) =>
        q.eq("sessionId", args.sessionId).eq("email", email),
      )
      .unique();

    if (existing) {
      throw new Error("This student is already marked present.");
    }

    const matchedProfile = await profileByEmail(ctx, email);
    if (
      matchedProfile &&
      (matchedProfile.batch !== session.batch ||
        matchedProfile.section !== session.section)
    ) {
      throw new Error("The matched profile belongs to another section.");
    }

    const now = Date.now();
    const recordId = await ctx.db.insert("attendanceRecords", {
      sessionId: args.sessionId,
      userId: matchedProfile?.userId,
      email,
      fullName: args.fullName.trim(),
      studentId,
      batch: session.batch,
      section: session.section,
      status: "present",
      source: "manual",
      submittedAt: now,
      addedBy: userId,
      reason,
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "attendance.manual_added",
      target: args.sessionId,
      metadata: { recordId, email, reason },
      createdAt: now,
    });

    return await ctx.db.get(recordId);
  },
});
