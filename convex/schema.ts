import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    email: v.string(),
    fullName: v.string(),
    studentId: v.string(),
    batch: v.string(),
    section: v.string(),
    role: v.union(v.literal("student"), v.literal("cr")),
    status: v.union(v.literal("active"), v.literal("blocked")),
    createdAt: v.number(),
    updatedAt: v.number(),
    promotedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_batch_section", ["batch", "section"]),

  crInvites: defineTable({
    email: v.string(),
    batch: v.string(),
    section: v.string(),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_batch_section", ["batch", "section"]),

  attendanceSessions: defineTable({
    routineEntryId: v.optional(v.string()),
    batch: v.string(),
    section: v.string(),
    courseCode: v.string(),
    courseTitle: v.optional(v.string()),
    teacher: v.string(),
    room: v.string(),
    mode: v.string(),
    program: v.string(),
    day: v.string(),
    classStart: v.string(),
    classEnd: v.string(),
    openedBy: v.id("users"),
    openedAt: v.number(),
    closesAt: v.number(),
    closedAt: v.optional(v.number()),
    status: v.union(v.literal("open"), v.literal("closed")),
    createdAt: v.number(),
  })
    .index("by_batch_section_status", ["batch", "section", "status"])
    .index("by_batch_section_opened", ["batch", "section", "openedAt"])
    .index("by_opened_at", ["openedAt"]),

  attendanceRecords: defineTable({
    sessionId: v.id("attendanceSessions"),
    userId: v.optional(v.id("users")),
    email: v.string(),
    fullName: v.string(),
    studentId: v.string(),
    batch: v.string(),
    section: v.string(),
    status: v.literal("present"),
    source: v.union(v.literal("student"), v.literal("manual")),
    submittedAt: v.number(),
    addedBy: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_user", ["sessionId", "userId"])
    .index("by_session_email", ["sessionId", "email"])
    .index("by_user", ["userId"]),

  auditLogs: defineTable({
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    target: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),
});
