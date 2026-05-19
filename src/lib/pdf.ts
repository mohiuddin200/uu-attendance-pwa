import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SessionDetails } from '../types'
import { formatDateTime } from './routine'

export function downloadAttendancePdf(details: SessionDetails) {
  const { session, records } = details
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('Uttara University Attendance', 14, 18)

  doc.setFontSize(10)
  doc.text(`Course: ${session.courseCode}`, 14, 28)
  doc.text(`Teacher: ${session.teacher || 'N/A'}`, 14, 34)
  doc.text(`Batch ${session.batch}, Section ${session.section}`, 14, 40)
  doc.text(`Room/Platform: ${session.room || 'N/A'}`, 14, 46)
  doc.text(`Class: ${session.day}, ${session.classStart} - ${session.classEnd}`, 14, 52)
  doc.text(`Attendance opened: ${formatDateTime(session.openedAt)}`, 14, 58)
  doc.text(`Attendance closed: ${formatDateTime(session.closesAt)}`, 14, 64)
  doc.text(`Total present: ${records.length}`, 14, 70)

  autoTable(doc, {
    startY: 78,
    head: [['#', 'Student ID', 'Name', 'Email', 'Source', 'Submitted']],
    body: records.map((record, index) => [
      index + 1,
      record.studentId,
      record.fullName,
      record.email,
      record.source === 'manual' ? `Manual: ${record.reason ?? ''}` : 'Student',
      formatDateTime(record.submittedAt),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [15, 118, 110],
    },
  })

  const date = new Date(session.openedAt).toISOString().slice(0, 10)
  doc.save(`attendance-${session.batch}${session.section}-${session.courseCode}-${date}.pdf`)
}
