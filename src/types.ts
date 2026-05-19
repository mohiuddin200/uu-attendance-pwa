export type Role = 'student' | 'cr'
export type AttendanceSource = 'student' | 'manual'
export type SessionStatus = 'open' | 'closed'

export interface Profile {
  _id: string
  userId: string
  email: string
  fullName: string
  studentId: string
  batch: string
  section: string
  role: Role
  status: 'active' | 'blocked'
  createdAt: number
  updatedAt: number
}

export interface CurrentUserResult {
  userId: string
  email: string
  name: string
  image: string
  isAllowedEmail: boolean
  profile: Profile | null
}

export interface RoutineData {
  meta: {
    title: string
    term: string
    department: string
    scope: string
    availableDays: string[]
  }
  days: string[]
  slots: Array<{ slot: number; start: string; end: string }>
  batches: string[]
  entries: RoutineEntryRaw[]
}

export interface RoutineEntryRaw {
  id: string
  page: number
  mode: string
  program: string
  batch: string
  day: string
  slot: number
  start: string
  end: string
  course: string
  teacher: string
  room: string
}

export interface RoutineEntry {
  id: string
  batch: string
  section: string
  batchLabel: string
  day: string
  start: string
  end: string
  course: string
  teacher: string
  room: string
  mode: string
  program: string
  slot: number
}

export interface AttendanceSession {
  _id: string
  routineEntryId?: string
  batch: string
  section: string
  courseCode: string
  courseTitle?: string
  teacher: string
  room: string
  mode: string
  program: string
  day: string
  classStart: string
  classEnd: string
  openedBy: string
  openedAt: number
  closesAt: number
  closedAt?: number
  status: SessionStatus
  createdAt: number
}

export interface AttendanceRecord {
  _id: string
  sessionId: string
  userId?: string
  email: string
  fullName: string
  studentId: string
  batch: string
  section: string
  status: 'present'
  source: AttendanceSource
  submittedAt: number
  addedBy?: string
  reason?: string
}

export interface SessionDetails {
  session: AttendanceSession
  records: AttendanceRecord[]
}

export interface RecentAttendanceRecord {
  record: AttendanceRecord
  session: AttendanceSession | null
}
