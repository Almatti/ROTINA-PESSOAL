"use client";
/** Exportação CSV (compatível com Excel pt-BR: ; e BOM UTF-8) e PDF. */
export function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [columns.map((c) => esc(c.label)).join(";"), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(";"))].join("\r\n");
}

export function download(filename: string, content: string | Blob, mime = "text/csv;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPDF(title: string, subtitle: string, head: string[], body: (string | number)[][], filename: string, summary?: [string, string][]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFillColor(49, 42, 68);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.text(subtitle, 40, 58);
  let y = 95;
  doc.setTextColor(49, 42, 68);
  if (summary?.length) {
    doc.setFontSize(11);
    for (const [k, v] of summary) {
      doc.text(`${k}: ${v}`, 40, y);
      y += 16;
    }
    y += 6;
  }
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [116, 81, 166], textColor: 255 },
    alternateRowStyles: { fillColor: [247, 244, 251] },
  });
  doc.save(filename);
}
