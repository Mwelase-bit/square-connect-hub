export async function buildPdf(
  title: string,
  lines: string[],
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(150, 20, 25);
  doc.text("ROYAL SQUARE FINANCIAL (Pty) Ltd", 40, 50);
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, 76);
  doc.setDrawColor(150, 20, 25);
  doc.line(40, 86, 555, 86);
  doc.setFontSize(10);
  let y = 110;
  for (const line of lines) {
    for (const wrapped of doc.splitTextToSize(line, 510) as string[]) {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
      doc.text(wrapped, 40, y);
      y += 16;
    }
  }
  return doc.output("datauristring");
}

export function downloadPdf(dataUri: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  a.click();
}
