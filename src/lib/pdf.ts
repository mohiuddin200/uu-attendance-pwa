import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "../assets/uu-logo.png";
import type { SessionDetails } from "../types";
import { formatClockRange, formatDateTime } from "./routine";

const BRAND = {
  primary: [15, 118, 110] as [number, number, number],
  primaryDark: [13, 90, 84] as [number, number, number],
  accent: [217, 240, 235] as [number, number, number],
  ink: [23, 33, 31] as [number, number, number],
  muted: [97, 113, 109] as [number, number, number],
  border: [223, 229, 226] as [number, number, number],
  zebra: [246, 248, 247] as [number, number, number],
};

let cachedLogo: string | null = null;

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return null;
  }
}

export async function downloadAttendancePdf(details: SessionDetails) {
  const { session, records } = details;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const logo = await loadLogoDataUrl();

  drawHeader(doc, pageWidth, logo);
  const metaBottom = drawMetaBlock(
    doc,
    session,
    records.length,
    margin,
    pageWidth,
  );
  drawSectionTitle(doc, "Present Students", margin, metaBottom + 10);

  autoTable(doc, {
    startY: metaBottom + 14,
    margin: { left: margin, right: margin },
    head: [["#", "Student ID", "Name", "Email", "Submitted"]],
    body: records.map((record, index) => [
      String(index + 1),
      record.studentId,
      record.fullName,
      record.email,
      formatDateTime(record.submittedAt),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      textColor: BRAND.ink,
      lineColor: BRAND.border,
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: BRAND.zebra,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 42 },
      3: { cellWidth: 50 },
      4: { cellWidth: "auto" },
    },
    didDrawPage: () => {
      drawFooter(doc, pageWidth, pageHeight, margin);
    },
  });

  if (records.length === 0) {
    drawFooter(doc, pageWidth, pageHeight, margin);
  }

  const date = new Date(session.openedAt).toISOString().slice(0, 10);
  doc.save(
    `attendance-${session.batch}${session.section}-${session.courseCode}-${date}.pdf`,
  );
}

function drawHeader(doc: jsPDF, pageWidth: number, logo: string | null) {
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setFillColor(...BRAND.primaryDark);
  doc.rect(0, 30, pageWidth, 1.2, "F");

  if (logo) {
    const logoCardWidth = 36;
    const logoCardHeight = 20;
    const logoCardX = 14;
    const logoCardY = 5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(
      logoCardX,
      logoCardY,
      logoCardWidth,
      logoCardHeight,
      2,
      2,
      "F",
    );
    doc.addImage(
      logo,
      "PNG",
      logoCardX + 2,
      logoCardY + 2,
      logoCardWidth - 4,
      logoCardHeight - 4,
      undefined,
      "FAST",
    );
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Attendance Record", pageWidth - 14, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Uttara University", pageWidth - 14, 23, { align: "right" });
}

function drawMetaBlock(
  doc: jsPDF,
  session: SessionDetails["session"],
  presentCount: number,
  margin: number,
  pageWidth: number,
) {
  const top = 40;
  const blockWidth = pageWidth - margin * 2;
  const hasTitle = Boolean(session.courseTitle);
  const headerBlockHeight = hasTitle ? 32 : 26;
  const rowGap = 14;
  const bottomPad = 7;
  const rowAreaHeight = 10 + rowGap;
  const blockHeight = headerBlockHeight + rowAreaHeight + bottomPad;

  doc.setDrawColor(...BRAND.border);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, top, blockWidth, blockHeight, 2, 2, "FD");

  const chipCenterY = top + 10;
  drawPresentChip(doc, presentCount, pageWidth - margin - 6, chipCenterY);

  const titleX = margin + 6;
  if (hasTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND.ink);
    const titleMaxWidth = blockWidth - 12 - 36;
    const titleLines = doc.splitTextToSize(
      session.courseTitle ?? "",
      titleMaxWidth,
    );
    doc.text(titleLines[0] ?? "", titleX, top + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(session.courseCode, titleX, top + 16);

    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Batch ${session.batch} · Section ${session.section}`,
      titleX,
      top + 22,
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND.ink);
    doc.text(session.courseCode, titleX, top + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Batch ${session.batch} · Section ${session.section}`,
      titleX,
      top + 16,
    );
  }

  const colGap = 6;
  const colWidth = (blockWidth - 12 - colGap) / 2;
  const leftX = margin + 6;
  const rightX = margin + 6 + colWidth + colGap;
  const rowY = top + headerBlockHeight;

  drawMetaRow(doc, "Teacher", session.teacher || "N/A", leftX, rowY, colWidth);
  drawMetaRow(
    doc,
    "Room / Platform",
    session.room || "N/A",
    rightX,
    rowY,
    colWidth,
  );
  drawMetaRow(
    doc,
    "Class",
    `${session.day}, ${formatClockRange(session.classStart, session.classEnd)}`,
    leftX,
    rowY + rowGap,
    colWidth,
  );
  drawMetaTwoLineRow(
    doc,
    "Window",
    `Opened ${formatDateTime(session.openedAt)}`,
    `Closes ${formatDateTime(session.closesAt)}`,
    rightX,
    rowY + rowGap,
    colWidth,
  );

  return top + blockHeight;
}

function drawMetaRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  const lines = doc.splitTextToSize(value, width);
  doc.text(lines[0] ?? value, x, y + 4);
}

function drawMetaTwoLineRow(
  doc: jsPDF,
  label: string,
  line1: string,
  line2: string,
  x: number,
  y: number,
  width: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.ink);
  const fitted1 = doc.splitTextToSize(line1, width)[0] ?? line1;
  const fitted2 = doc.splitTextToSize(line2, width)[0] ?? line2;
  doc.text(fitted1, x, y + 4);
  doc.text(fitted2, x, y + 8.5);
}

function drawPresentChip(
  doc: jsPDF,
  count: number,
  rightX: number,
  centerY: number,
) {
  const label = `${count} Present`;
  const padX = 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const textWidth = doc.getTextWidth(label);
  const chipWidth = textWidth + padX * 2;
  const chipHeight = 7.5;
  const chipX = rightX - chipWidth;
  const chipY = centerY - chipHeight / 2 - 0.5;

  doc.setFillColor(...BRAND.accent);
  doc.roundedRect(chipX, chipY, chipWidth, chipHeight, 3.5, 3.5, "F");
  doc.setTextColor(...BRAND.primaryDark);
  doc.text(label, chipX + padX, chipY + chipHeight / 2 + 1.6);
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  doc.text(title, x, y);

  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.8);
  const titleWidth = doc.getTextWidth(title);
  doc.line(x, y + 1.4, x + titleWidth, y + 1.4);
  doc.setLineWidth(0.1);
}

function drawFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
) {
  const y = pageHeight - 10;
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.2);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Generated ${formatDateTime(Date.now())}`, margin, y);

  const pageInfo = doc.getCurrentPageInfo();
  const totalPages = doc.getNumberOfPages();
  doc.text(
    `Page ${pageInfo.pageNumber} of ${totalPages}`,
    pageWidth - margin,
    y,
    { align: "right" },
  );
}
