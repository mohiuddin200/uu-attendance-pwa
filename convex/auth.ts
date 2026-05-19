import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const UNIVERSITY_DOMAIN = "uttara.ac.bd";
const SUPPORTED_BATCHES = ["67"];
const SUPPORTED_SECTIONS = ["A", "B", "C", "D"];

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

function stringParam(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(
  params: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = stringParam(params, key);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function assertSupportedSection(batch: string, section: string) {
  if (!SUPPORTED_BATCHES.includes(batch)) {
    throw new Error(`Batch ${batch} is not enabled yet.`);
  }
  if (!SUPPORTED_SECTIONS.includes(section)) {
    throw new Error(`Section ${section} is not enabled yet.`);
  }
}

function profileFromParams(params: Record<string, unknown>) {
  const flow = stringParam(params, "flow");
  const email = normalizeEmail(
    requiredString(params, "email", "Education email"),
  );
  if (!isUniversityEmail(email)) {
    throw new Error(`Only @${UNIVERSITY_DOMAIN} emails can use this app.`);
  }

  const fullName =
    stringParam(params, "fullName") || stringParam(params, "name") || email;
  const profile = { email, name: fullName };

  if (flow !== "signUp") {
    return profile;
  }

  const studentId = studentIdFromEmail(email);
  const batch = requiredString(params, "batch", "Batch");
  const section = requiredString(params, "section", "Section").toUpperCase();
  assertSupportedSection(batch, section);

  return {
    ...profile,
    fullName,
    studentId,
    batch,
    section,
  };
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => profileFromParams(params),
      validatePasswordRequirements: (password) => {
        if (password.length < 4) {
          throw new Error("Password must be at least 4 characters long.");
        }
      },
    }),
  ],
  callbacks: {
    createOrUpdateUser: async (ctx, args) => {
      const email = normalizeEmail(
        requiredString(args.profile, "email", "Education email"),
      );
      const fullName = requiredString(args.profile, "fullName", "Full name");
      const studentId = studentIdFromEmail(email);
      const batch = requiredString(args.profile, "batch", "Batch");
      const section = requiredString(
        args.profile,
        "section",
        "Section",
      ).toUpperCase();
      assertSupportedSection(batch, section);

      const now = Date.now();
      const userId =
        args.existingUserId ??
        (await ctx.db.insert("users", {
          email,
          name: fullName,
        }));

      if (args.existingUserId) {
        await ctx.db.patch(userId, {
          email,
          name: fullName,
        });
      }

      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const role = parseInitialCrEmails().includes(email) ? "cr" : "student";

      if (existingProfile) {
        await ctx.db.patch(existingProfile._id, {
          email,
          fullName,
          studentId,
          batch,
          section,
          role: existingProfile.role === "cr" ? "cr" : role,
          status: "active",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("profiles", {
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
      }

      await ctx.db.insert("auditLogs", {
        actorUserId: userId,
        action: "auth.signup",
        target: email,
        metadata: { batch, section, role },
        createdAt: now,
      });

      return userId;
    },
  },
});
