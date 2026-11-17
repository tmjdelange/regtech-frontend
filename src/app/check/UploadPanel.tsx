"use client";

import { FormEvent, useState } from "react";

// Mirrors ExtractionResponse in the backend's schemas.py.
export type ExtractionSource = "label" | "lab_report";
type Confidence = "high" | "medium" | "low";

export type ExtractedNumberSource = {
  value: number;
  source: ExtractionSource;
  quote: string;
  confidence: Confidence;
  original_text: string;
  converted_from_unit: string | null;
};

export type ExtractedNumber = {
  value: number | null;
  source: ExtractionSource | null;
  quote: string | null;
  confidence: Confidence | null;
  original_text: string | null;
  converted_from_unit: string | null;
  label: ExtractedNumberSource | null;
  lab_report: ExtractedNumberSource | null;
};

export type ExtractedLabelCheck = {
  value: "yes" | "not_found" | "unclear";
  source: "label" | null;
  quote: string | null;
  confidence: Confidence | null;
};

export type Extraction = {
  abv_percent: ExtractedNumber & { conflict: boolean };
  total_sugars_g_per_100ml: ExtractedNumber;
  label_uk_fbo_address: ExtractedLabelCheck;
  label_product_name_english: ExtractedLabelCheck;
  label_ingredients_with_allergens_highlighted: ExtractedLabelCheck;
  label_country_of_origin: ExtractedLabelCheck;
};

export const SOURCE_TEXT: Record<ExtractionSource, string> = {
  label: "From your label",
  lab_report: "From your lab report",
};

const MAX_LABEL_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// The upload goes through a serverless function whose request body is capped
// at about 4.5 MB, so images are shrunk first and the total is checked here.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
// Matches the size the backend sends to the model, so nothing useful is lost.
const MAX_IMAGE_EDGE = 1600;

const LABEL_TYPES = ["image/png", "image/jpeg", "application/pdf"];

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      0.85
    )
  );
}

function checkFiles(labels: File[], labReport: File | null): string | null {
  if (labels.length === 0 && !labReport) {
    return "Choose a label file or a lab report first.";
  }
  if (labels.length > MAX_LABEL_FILES) {
    return `Choose at most ${MAX_LABEL_FILES} label files.`;
  }
  if (labels.some((f) => !LABEL_TYPES.includes(f.type))) {
    return "Label files must be PNG, JPG or PDF.";
  }
  if (labReport && labReport.type !== "application/pdf") {
    return "The lab report must be a PDF.";
  }
  if ([...labels, labReport].some((f) => f && f.size > MAX_FILE_BYTES)) {
    return "Each file can be at most 10 MB.";
  }
  return null;
}

export default function UploadPanel({
  onExtracted,
}: {
  onExtracted: (extraction: Extraction) => void;
}) {
  const [labels, setLabels] = useState<File[]>([]);
  const [labReport, setLabReport] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    const problem = checkFiles(labels, labReport);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body = new FormData();
      for (const file of labels) {
        if (file.type === "application/pdf") {
          body.append("label", file, file.name);
        } else {
          try {
            body.append("label", await shrinkImage(file), `${file.name}.jpg`);
          } catch {
            setError(`Couldn't read the image ${file.name}.`);
            return;
          }
        }
      }
      if (labReport) body.append("lab_report", labReport, labReport.name);

      const total = [...body.values()].reduce(
        (sum, value) => sum + (value instanceof Blob ? value.size : 0),
        0
      );
      if (total > MAX_TOTAL_BYTES) {
        setError(
          "Together your files are larger than 4 MB. Try fewer label files or a smaller PDF."
        );
        return;
      }

      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || data === null) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.error === "string"
              ? data.error
              : `Something went wrong (error ${res.status})`;
        setError(
          res.status === 429 || res.status === 422
            ? detail
            : `${detail}. Please try again in a moment, or fill in the form by hand.`
        );
        return;
      }
      onExtracted(data as Extraction);
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded border border-gray-300 p-4 print:hidden"
      aria-labelledby="upload-heading"
    >
      <div className="space-y-1">
        <h2 id="upload-heading" className="text-lg font-semibold">
          Fill in part of the form from your documents (optional)
        </h2>
        <p className="text-sm text-gray-700">
          Upload your label and a lab report, and we&apos;ll suggest answers for
          ABV and the label questions. Check every suggestion before you run the
          check.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="upload-label" className="block font-medium">
          Label (PNG, JPG or PDF, up to 4 files)
        </label>
        <input
          id="upload-label"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          onChange={(e) => setLabels(Array.from(e.target.files ?? []))}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="upload-lab-report" className="block font-medium">
          Lab report (PDF)
        </label>
        <input
          id="upload-lab-report"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => setLabReport(e.target.files?.[0] ?? null)}
        />
      </div>

      <p className="text-sm text-gray-600">
        Privacy: your files are processed to read these values and are not
        stored. They are sent to our AI provider, Anthropic, for reading.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="border border-black px-4 py-2 rounded disabled:opacity-60"
      >
        {loading ? "Reading your files…" : "Extract values"}
      </button>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
            {error}
          </p>
        )}
        {done && !error && (
          <p className="text-sm text-gray-700">
            Done. Answers we found are filled in below and marked with where
            they came from. Questions we couldn&apos;t answer are left empty.
          </p>
        )}
      </div>
    </form>
  );
}
