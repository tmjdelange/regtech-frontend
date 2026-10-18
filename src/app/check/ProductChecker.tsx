"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

// Mirrors ChecklistProfile / ChecklistResponse in the backend's schemas.py.
type Status =
  | "action_needed"
  | "confirm"
  | "covered"
  | "not_applicable"
  | "not_assessed";

type ChecklistItem = {
  id: string;
  title: string;
  status: Status;
  action: string;
  source_url: string | null;
  source_excerpt: string;
  reviewed: boolean;
  not_assessed_reason: "source_missing" | "source_unverified" | null;
};

type ChecklistResult = {
  headline: string;
  counts: Record<Status, number>;
  items: ChecklistItem[];
  checks_assessed: number;
  checks_total: number;
  scope: string;
  disclaimer: string;
};

type ChecklistOutOfScope = { message: string };

type Option = { value: string; label: string };
type RadioQuestion = {
  kind: "radio";
  name: string;
  legend: string;
  hint?: string;
  options: Option[];
};
type NumberQuestion = {
  kind: "number";
  name: string;
  label: string;
  unit: string;
  hint?: string;
  max: number;
};
type Question = RadioQuestion | NumberQuestion;

const UNKNOWN: Option = { value: "unknown", label: "I don't know" };
const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const YES_NO_UNKNOWN: Option[] = [...YES_NO, UNKNOWN];

const LABEL_ELEMENTS = [
  "english_name",
  "ingredients_list_with_allergens",
  "origin_statement",
] as const;

const labelElementField = (element: string) => `label_has_${element}`;

const GROUPS: { title: string; questions: Question[] }[] = [
  {
    title: "Product",
    questions: [
      {
        kind: "number",
        name: "abv_percent",
        label: "Alcohol by volume (ABV)",
        unit: "%",
        hint: "Enter 0 for an alcohol-free drink. This checker covers drinks up to 1.2% ABV.",
        max: 100,
      },
      {
        kind: "number",
        name: "added_sugar_g_per_100ml",
        label: "Added sugar",
        unit: "g per 100 ml",
        hint: "Sugar added during production, not sugar naturally present in juice.",
        max: 100,
      },
    ],
  },
  {
    title: "Business",
    questions: [
      {
        kind: "radio",
        name: "annual_volume",
        legend: "How much of this drink do you expect to sell in the UK each year?",
        options: [
          { value: "under_1m", label: "Under 1 million litres" },
          { value: "1m_or_more", label: "1 million litres or more" },
          UNKNOWN,
        ],
      },
      {
        kind: "radio",
        name: "uk_importer",
        legend: "Do you have a UK-based importer?",
        options: [...YES_NO, { value: "not_decided", label: "Not decided yet" }],
      },
      {
        kind: "radio",
        name: "importer_has_eori",
        legend: "Does the importer have an EORI number?",
        options: YES_NO_UNKNOWN,
      },
    ],
  },
  {
    title: "Label",
    questions: [
      {
        kind: "radio",
        name: "label_uk_address",
        legend: "Does the label show the UK address of the food business operator?",
        options: YES_NO_UNKNOWN,
      },
      {
        kind: "radio",
        name: labelElementField("english_name"),
        legend: "Does the label show the product's name in English?",
        options: YES_NO,
      },
      {
        kind: "radio",
        name: labelElementField("ingredients_list_with_allergens"),
        legend: "Does the label have an ingredients list with allergens highlighted?",
        options: YES_NO,
      },
      {
        kind: "radio",
        name: labelElementField("origin_statement"),
        legend: "Does the label state the country of origin?",
        options: YES_NO,
      },
    ],
  },
  {
    title: "Paperwork",
    questions: [
      {
        kind: "radio",
        name: "origin_proof",
        legend: "Do you have proof of origin for the goods?",
        hint: "For example a statement on origin on the invoice, needed for tariff-free UK-EU trade.",
        options: YES_NO_UNKNOWN,
      },
      {
        kind: "radio",
        name: "invoice_ready",
        legend: "Is the commercial invoice for customs clearance ready?",
        options: YES_NO_UNKNOWN,
      },
    ],
  },
];

const ALL_QUESTIONS = GROUPS.flatMap((g) => g.questions);

type Answers = Record<string, string>;

// The ginger beer scenario from test_checklist_scenario_from_brief in the
// backend's test_main.py.
const EXAMPLE_ANSWERS: Answers = {
  abv_percent: "0.4",
  added_sugar_g_per_100ml: "6.5",
  annual_volume: "under_1m",
  uk_importer: "yes",
  importer_has_eori: "unknown",
  label_uk_address: "no",
  [labelElementField("english_name")]: "yes",
  [labelElementField("ingredients_list_with_allergens")]: "yes",
  [labelElementField("origin_statement")]: "yes",
  origin_proof: "no",
  invoice_ready: "no",
};

function parseNumber(raw: string): number | null {
  const normalised = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  return Number(normalised);
}

function validate(answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    const raw = answers[q.name] ?? "";
    if (q.kind === "number") {
      if (raw.trim() === "") {
        errors[q.name] = "Enter a number.";
      } else if (raw.trim().startsWith("-")) {
        errors[q.name] = "Enter a number that is 0 or more.";
      } else {
        const value = parseNumber(raw);
        if (value === null) {
          errors[q.name] = "Enter a number, for example 0.5.";
        } else if (value > q.max) {
          errors[q.name] = `Enter a number no more than ${q.max}.`;
        }
      }
    } else if (!raw) {
      errors[q.name] = "Choose an answer.";
    }
  }
  return errors;
}

function buildProfile(answers: Answers) {
  return {
    abv_percent: parseNumber(answers.abv_percent ?? ""),
    added_sugar_g_per_100ml: parseNumber(answers.added_sugar_g_per_100ml ?? ""),
    annual_volume: answers.annual_volume,
    uk_importer: answers.uk_importer,
    label_uk_address: answers.label_uk_address,
    importer_has_eori: answers.importer_has_eori,
    origin_proof: answers.origin_proof,
    invoice_ready: answers.invoice_ready,
    label_elements: LABEL_ELEMENTS.filter(
      (element) => answers[labelElementField(element)] === "yes"
    ),
  };
}

const STATUS_META: Record<
  Status,
  { label: string; icon: string; chip: string; card: string }
> = {
  action_needed: {
    label: "Action needed",
    icon: "!",
    chip: "bg-red-50 text-red-900 border-red-300",
    card: "border-l-red-600",
  },
  confirm: {
    label: "To confirm",
    icon: "?",
    chip: "bg-amber-50 text-amber-900 border-amber-300",
    card: "border-l-amber-500",
  },
  covered: {
    label: "Covered",
    icon: "✓",
    chip: "bg-green-50 text-green-900 border-green-300",
    card: "border-l-green-600",
  },
  not_applicable: {
    label: "Not applicable",
    icon: "–",
    chip: "bg-gray-50 text-gray-800 border-gray-300",
    card: "border-l-gray-400",
  },
  not_assessed: {
    label: "Not assessed",
    icon: "…",
    chip: "bg-slate-50 text-slate-700 border-slate-300 border-dashed",
    card: "border-dashed border-l-slate-400 bg-slate-50 text-slate-700",
  },
};

const STATUS_ORDER: Status[] = [
  "action_needed",
  "confirm",
  "covered",
  "not_applicable",
  "not_assessed",
];

const DISCLAIMER =
  "Informational only, based on your answers and on reviewed sources, not legal advice or a compliance certificate.";

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${meta.chip}`}
    >
      <span aria-hidden="true" className="font-bold">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function Report({ result, stale }: { result: ChecklistResult; stale: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  return (
    <section aria-labelledby="report-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2
          id="report-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          Your report
        </h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-black px-4 py-2 rounded print:hidden"
        >
          Print / save as PDF
        </button>
      </div>

      {stale && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 print:hidden">
          You&apos;ve changed your answers since this report was made. Run the
          check again to update it.
        </p>
      )}

      <p className="text-lg">{result.headline}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Results by status">
        {STATUS_ORDER.map((status) => (
          <li key={status}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${STATUS_META[status].chip}`}
            >
              <span aria-hidden="true" className="font-bold">
                {STATUS_META[status].icon}
              </span>
              {STATUS_META[status].label}:{" "}
              <strong>{result.counts[status]}</strong>
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <p className="font-medium">
          Checks assessed: {result.checks_assessed} of {result.checks_total}
        </p>
        <p className="text-sm text-gray-600">{result.scope}</p>
      </div>

      {result.checks_assessed === 0 && (
        <p className="text-gray-600">
          No checks could be run right now because none of the underlying
          sources have been reviewed yet.
        </p>
      )}

      {result.items.length > 0 && (
        <ol className="space-y-4">
          {result.items.map((item) => (
            <li
              key={item.id}
              className={`break-inside-avoid rounded border border-l-8 p-4 space-y-3 ${STATUS_META[item.status].card}`}
            >
              <StatusBadge status={item.status} />
              <h3 className="font-semibold">{item.title}</h3>
              <p>{item.action}</p>
              {item.status !== "not_assessed" && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Why</summary>
                  <div className="mt-2 space-y-2">
                    <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-700 whitespace-pre-line">
                      {item.source_excerpt}
                    </blockquote>
                    {item.source_url ? (
                      <p>
                        Source:{" "}
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {hostnameOf(item.source_url)}
                        </a>
                      </p>
                    ) : (
                      <p className="text-gray-600">No source link available.</p>
                    )}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Collapsed "Why" sections wouldn't appear on paper, so open them for the
// duration of the print and restore them afterwards.
function useExpandDetailsForPrint() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = Array.from(document.querySelectorAll("details")).filter(
        (d) => !d.open
      );
      opened.forEach((d) => (d.open = true));
    };
    const after = () => {
      opened.forEach((d) => (d.open = false));
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
}

export default function ProductChecker() {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [outOfScope, setOutOfScope] = useState<string | null>(null);
  const [submittedProfile, setSubmittedProfile] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useExpandDetailsForPrint();

  function setAnswer(name: string, value: string) {
    const next = { ...answers, [name]: value };
    setAnswers(next);
    if (attempted) setErrors(validate(next));
  }

  function loadExample() {
    setAnswers(EXAMPLE_ANSWERS);
    setErrors({});
    setAttempted(false);
    setRequestError(null);
    setResult(null);
    setOutOfScope(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    const found = validate(answers);
    setErrors(found);
    const firstInvalid = ALL_QUESTIONS.find((q) => found[q.name]);
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalid.name}"]`)
        ?.focus();
      return;
    }

    const profile = buildProfile(answers);
    setLoading(true);
    setRequestError(null);
    setResult(null);
    setOutOfScope(null);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data === null) {
        setRequestError(
          res.status === 422
            ? "Some of your answers weren't accepted. Check the form and try again."
            : typeof data?.error === "string"
              ? `${data.error}. Please try again in a moment.`
              : `Something went wrong (error ${res.status}). Please try again in a moment.`
        );
      } else if ("message" in data) {
        setOutOfScope((data as ChecklistOutOfScope).message);
      } else {
        setResult(data as ChecklistResult);
        setSubmittedProfile(JSON.stringify(profile));
      }
    } catch {
      setRequestError(
        "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const errorCount = Object.keys(errors).length;
  const stale =
    result !== null && submittedProfile !== JSON.stringify(buildProfile(answers));

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <div className="space-y-2 print:hidden">
        <Link href="/" className="text-sm underline">
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold">Check my product</h1>
        <p className="text-gray-700">
          Answer a few questions about a soft drink you want to import into the
          UK. We&apos;ll list what to act on, what to confirm and what&apos;s
          already covered.
        </p>
      </div>
      <h1 className="hidden print:block text-2xl font-bold">
        UK import check — report
      </h1>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="space-y-8 print:hidden"
      >
        <button
          type="button"
          onClick={loadExample}
          className="border border-black px-4 py-2 rounded"
        >
          Load example
        </button>

        {errorCount > 0 && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
            {errorCount === 1
              ? "1 answer needs your attention."
              : `${errorCount} answers need your attention.`}
          </p>
        )}

        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-6 border-t pt-4">
            <legend className="text-lg font-semibold pr-2">{group.title}</legend>
            {group.questions.map((q) =>
              q.kind === "number" ? (
                <NumberInput
                  key={q.name}
                  question={q}
                  value={answers[q.name] ?? ""}
                  error={errors[q.name]}
                  onChange={(v) => setAnswer(q.name, v)}
                />
              ) : (
                <RadioGroup
                  key={q.name}
                  question={q}
                  value={answers[q.name] ?? ""}
                  error={errors[q.name]}
                  onChange={(v) => setAnswer(q.name, v)}
                />
              )
            )}
          </fieldset>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading ? "Checking…" : "Check my product"}
        </button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {loading && <p className="print:hidden">Checking your answers…</p>}
        {requestError && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
            {requestError}
          </p>
        )}
        {outOfScope && (
          <div className="rounded border border-gray-300 bg-gray-50 p-4 space-y-1">
            <p className="font-semibold">Outside what this checker covers</p>
            <p>{outOfScope}</p>
          </div>
        )}
      </div>

      {result && <Report result={result} stale={stale} />}

      <footer className="border-t pt-4 text-sm text-gray-600">
        <p>{DISCLAIMER}</p>
      </footer>
    </main>
  );
}

function NumberInput({
  question,
  value,
  error,
  onChange,
}: {
  question: NumberQuestion;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `q-${question.name}`;
  const describedBy = [
    question.hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium">
        {question.label} ({question.unit})
      </label>
      {question.hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-600">
          {question.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={question.name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`w-32 border rounded p-2 ${error ? "border-red-600 border-2" : ""}`}
        />
        <span aria-hidden="true">{question.unit}</span>
      </div>
    </div>
  );
}

function RadioGroup({
  question,
  value,
  error,
  onChange,
}: {
  question: RadioQuestion;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `q-${question.name}`;
  const describedBy = [
    question.hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <fieldset
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
      className={`space-y-2 ${error ? "border-l-4 border-red-600 pl-3" : ""}`}
    >
      <legend className="font-medium">{question.legend}</legend>
      {question.hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-600">
          {question.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {question.options.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={question.name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
