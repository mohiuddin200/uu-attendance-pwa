import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";

const UNIVERSITY_DOMAIN = "uttara.ac.bd";
const SUPPORTED_BATCHES = ["67"];
const SUPPORTED_SECTIONS = ["A", "B", "C", "D"];

type AppCtx = QueryCtx | MutationCtx;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isUniversityEmail(email: string) {
  return normalizeEmail(email).endsWith(`@${UNIVERSITY_DOMAIN}`);
}

function studentIdFromEmail(email: string) {
  const studentId = normalizeEmail(email).split("@")[0] ?? "";
  if (!studentId) {
    throw new Error("Education email must include your student ID before @.");
  }
  if (!/^\d+$/.test(studentId)) {
    throw new Error("Education email must start with your numeric student ID.");
  }
  return studentId;
}

function parseInitialCrEmails() {
  return (process.env.INITIAL_CR_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function assertSupportedSection(batch: string, section: string) {
  if (!SUPPORTED_BATCHES.includes(batch)) {
    throw new Error(`Batch ${batch} is not enabled yet.`);
  }
  if (!SUPPORTED_SECTIONS.includes(section)) {
    throw new Error(`Section ${section} is not enabled yet.`);
  }
}

async function signedInUser(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Please sign in first.");
  }

  const user = await ctx.db.get(userId);
  const email = normalizeEmail(user?.email ?? "");
  if (!email || !isUniversityEmail(email)) {
    throw new Error(`Only @${UNIVERSITY_DOMAIN} emails can use this app.`);
  }

  return { userId, user, email };
}

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

async function pendingCrInvite(ctx: AppCtx, email: string) {
  const invites = await ctx.db
    .query("crInvites")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .collect();

  return invites.find((invite) => invite.status === "pending");
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    const email = normalizeEmail(user?.email ?? "");
    const profile = await profileByUserId(ctx, userId);

    return {
      userId,
      email,
      name: user?.name ?? "",
      image: user?.image ?? "",
      isAllowedEmail: Boolean(email && isUniversityEmail(email)),
      profile,
    };
  },
});

export const completeProfile = mutation({
  args: {
    fullName: v.string(),
    batch: v.string(),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user, email } = await signedInUser(ctx);
    const fullName = args.fullName.trim() || user?.name || email;
    const studentId = studentIdFromEmail(email);
    const batch = args.batch.trim();
    const section = args.section.trim().toUpperCase();

    assertSupportedSection(batch, section);

    const existing = await profileByUserId(ctx, userId);
    const invite = await pendingCrInvite(ctx, email);
    const isInitialCr = parseInitialCrEmails().includes(email);
    const role =
      existing?.role === "cr" || invite || isInitialCr ? "cr" : "student";
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName,
        studentId,
        batch,
        section,
        role,
        status: "active",
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const profileId = await ctx.db.insert("profiles", {
      userId,
      email,
      fullName,
      studentId,
      batch,
      section,
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    if (invite) {
      await ctx.db.patch(invite._id, {
        status: "accepted",
        acceptedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "profile.completed",
      target: email,
      metadata: { batch, section, role },
      createdAt: now,
    });

    return await ctx.db.get(profileId);
  },
});

export const inviteCr = mutation({
  args: {
    email: v.string(),
    batch: v.string(),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await signedInUser(ctx);
    const actor = await profileByUserId(ctx, userId);
    if (!actor || actor.role !== "cr") {
      throw new Error("Only CRs can invite another CR.");
    }

    const email = normalizeEmail(args.email);
    const batch = args.batch.trim();
    const section = args.section.trim().toUpperCase();
    assertSupportedSection(batch, section);

    if (!isUniversityEmail(email)) {
      throw new Error(`CR email must be an @${UNIVERSITY_DOMAIN} email.`);
    }
    if (actor.batch !== batch || actor.section !== section) {
      throw new Error("You can invite CRs only for your own section.");
    }

    const now = Date.now();
    const existingProfile = await profileByEmail(ctx, email);
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        role: "cr",
        promotedBy: userId,
        updatedAt: now,
      });
    }

    const existingInvite = await pendingCrInvite(ctx, email);
    if (!existingInvite) {
      await ctx.db.insert("crInvites", {
        email,
        batch,
        section,
        invitedBy: userId,
        status: "pending",
        createdAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      actorUserId: userId,
      action: "cr.invited",
      target: email,
      metadata: { batch, section },
      createdAt: now,
    });

    return { ok: true };
  },
});

export const listSectionPeople = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await signedInUser(ctx);
    const actor = await profileByUserId(ctx, userId);
    if (!actor || actor.role !== "cr") {
      throw new Error("Only CRs can view the section roster.");
    }

    return await ctx.db
      .query("profiles")
      .withIndex("by_batch_section", (q) =>
        q.eq("batch", actor.batch).eq("section", actor.section),
      )
      .collect();
  },
});
