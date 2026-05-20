export const UNIVERSITY_DOMAIN = "uttara.ac.bd";
export const SUPPORTED_BATCHES = ["67"];
export const SUPPORTED_SECTIONS = ["A", "B", "C", "D"];

type StudentIdCopy = "your" | "the";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isUniversityEmail(email: string) {
  return normalizeEmail(email).endsWith(`@${UNIVERSITY_DOMAIN}`);
}

export function studentIdFromEmail(email: string, copy: StudentIdCopy = "your") {
  const studentId = normalizeEmail(email).split("@")[0] ?? "";
  if (!studentId) {
    throw new Error(`Education email must include ${copy} student ID before @.`);
  }
  if (!/^\d+$/.test(studentId)) {
    throw new Error(
      `Education email must start with ${copy} numeric student ID.`,
    );
  }
  return studentId;
}

export function parseInitialCrEmails() {
  return (process.env.INITIAL_CR_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function assertSupportedSection(batch: string, section: string) {
  if (!SUPPORTED_BATCHES.includes(batch)) {
    throw new Error(`Batch ${batch} is not enabled yet.`);
  }
  if (!SUPPORTED_SECTIONS.includes(section)) {
    throw new Error(`Section ${section} is not enabled yet.`);
  }
}
