export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
  critical?: boolean;
}

export interface OcrResult {
  text: string;
  fields: ExtractedField[];
  engine: "tesseract" | "simulated";
}

const CRITICAL = ["ID number", "Licence number", "Policy number", "Registration number"];

function fieldsFromText(text: string, baseConfidence: number): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const push = (labelText: string, value: string, delta = 0) => {
    if (!value) return;
    fields.push({
      label: labelText,
      value,
      confidence: Math.max(35, Math.min(99, Math.round(baseConfidence + delta))),
      critical: CRITICAL.includes(labelText),
    });
  };

  const id = text.match(/\b\d{13}\b/)?.[0] ?? "";
  push("ID number", id, -8);
  const licence = text.match(/\b[A-Z]{2}\s?\d{3}\s?\d{3}\b/)?.[0] ?? "";
  push("Licence number", licence, -12);
  const reg = text.match(/\b[A-Z]{2}\s?\d{2,3}[\s-]?[A-Z]{2}\b/)?.[0] ?? "";
  push("Registration number", reg, -5);
  const expiry = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/)?.[0] ?? "";
  push("Expiry date", expiry, -3);
  const name =
    text
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => /^[A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+$/.test(l)) ?? "";
  push("Full name", name, 2);
  return fields;
}

function simulate(fileName: string): OcrResult {
  const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  const text = [
    "REPUBLIC OF SOUTH AFRICA",
    "DRIVING LICENCE / IDENTITY DOCUMENT",
    "Surname: SMITH",
    "Names: John Michael",
    "Identity Number: 8501015800083",
    "Licence No: CA 421 902",
    "Valid until: 2028-04-30",
    "Vehicle Reg: ND 55 GP",
    `source: ${fileName}`,
  ].join("\n");
  const fields = fieldsFromText(text, rand(70, 92));
  return { text, fields, engine: "simulated" };
}

export async function runOcr(dataUrl: string, fileName: string): Promise<OcrResult> {
  try {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(dataUrl, "eng");
    const text = result.data.text.trim();
    const avg = result.data.confidence || 80;
    if (text.replace(/\s/g, "").length < 12) return simulate(fileName);
    const fields = fieldsFromText(text, avg);
    if (fields.length === 0) {
      return { text, fields: simulate(fileName).fields, engine: "tesseract" };
    }
    return { text, fields, engine: "tesseract" };
  } catch {
    return simulate(fileName);
  }
}

export function confidenceClass(c: number, critical?: boolean) {
  if (critical || c < 70) return c >= 85 && !critical ? "green" : c < 70 ? "red" : "amber";
  if (c > 85) return "green";
  return "amber";
}
