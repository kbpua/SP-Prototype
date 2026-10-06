import { AMSTAR2_ITEMS, getExtractedFields, ROB2_DOMAINS, type CandidateStudy, type FieldId } from "@/data/mockData";
import {
  finalFieldValue,
  type DomainAssessment,
  type FieldVerification,
  type GradeDomain,
  type GradeLevel,
} from "@/state/ReviewContext";
import { parseRatioWithCi, type PooledResult, type StudyInput } from "./meta";

export type Verifications = Record<string, Partial<Record<FieldId, FieldVerification>>>;

export function finalValues(study: CandidateStudy, verification: Verifications) {
  const out: Partial<Record<FieldId, string | null>> = {};
  if (!study.trial) return out;
  for (const f of getExtractedFields(study.trial)) {
    out[f.def.id] = finalFieldValue(f.extracted, verification[study.id]?.[f.def.id]);
  }
  return out;
}

function toInt(v: string | null | undefined) {
  if (v == null) return NaN;
  return parseInt(v.replace(/[^\d]/g, ""), 10);
}

export function buildStudyInputs(studies: CandidateStudy[], verification: Verifications) {
  const inputs: StudyInput[] = [];
  const skipped: { study: CandidateStudy; reason: string }[] = [];
  for (const s of studies) {
    if (!s.trial) continue;
    const v = finalValues(s, verification);
    const input: StudyInput = {
      id: s.id,
      label: s.trial.acronym,
      year: s.year,
      nT: toInt(v.nT),
      nC: toInt(v.nC),
      eT: toInt(v.eT),
      eC: toInt(v.eC),
      hr: v.hr ? parseRatioWithCi(v.hr) : undefined,
    };
    if ([input.nT, input.nC, input.eT, input.eC].some((n) => !Number.isFinite(n))) {
      skipped.push({ study: s, reason: "Outcome counts rejected during verification" });
      continue;
    }
    inputs.push(input);
  }
  return { inputs, skipped };
}

export type RobOverall = { label: string; tone: "default" | "amber" | "coral" | "neutral" };

export function robOverall(a: Record<string, DomainAssessment> | undefined): RobOverall {
  const js = ROB2_DOMAINS.map((d) => a?.[d.id]?.judgement);
  if (js.some((j) => j === "high")) return { label: "High risk", tone: "coral" };
  if (js.some((j) => !j)) return { label: "Not assessed", tone: "neutral" };
  if (js.some((j) => j === "some")) return { label: "Some concerns", tone: "amber" };
  return { label: "Low risk", tone: "default" };
}

/** AMSTAR 2 overall confidence from the simple critical / non-critical "No" rules. */
export function amstarOverall(a: Record<string, DomainAssessment> | undefined): RobOverall {
  if (AMSTAR2_ITEMS.some((i) => !a?.[i.id]?.judgement)) return { label: "Not assessed", tone: "neutral" };
  const flaws = AMSTAR2_ITEMS.filter((i) => a?.[i.id]?.judgement === "no");
  const critical = flaws.filter((i) => i.critical).length;
  const weak = flaws.length - critical;
  if (critical > 1) return { label: "Critically low", tone: "coral" };
  if (critical === 1) return { label: "Low", tone: "coral" };
  if (weak > 1) return { label: "Moderate", tone: "amber" };
  return { label: "High", tone: "default" };
}

export const GRADE_DOMAINS: { id: GradeDomain; label: string; suggested: boolean }[] = [
  { id: "rob", label: "Risk of bias", suggested: true },
  { id: "consistency", label: "Consistency", suggested: true },
  { id: "precision", label: "Precision", suggested: true },
  { id: "directness", label: "Directness", suggested: false },
  { id: "reporting", label: "Reporting bias", suggested: false },
];

export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  "not-serious": "Not serious",
  serious: "Serious",
  "very-serious": "Very serious",
};

/** Simulated GRADE prefill: RoB from appraisal, consistency from I², precision from the CI. */
export function gradeSuggestions(
  pooled: PooledResult | null,
  robLabels: string[],
): Partial<Record<GradeDomain, GradeLevel>> {
  const out: Partial<Record<GradeDomain, GradeLevel>> = {};
  if (robLabels.length && !robLabels.includes("Not assessed")) {
    out.rob = robLabels.includes("High risk")
      ? "very-serious"
      : robLabels.includes("Some concerns")
        ? "serious"
        : "not-serious";
  }
  if (pooled) {
    out.consistency =
      pooled.studies.length < 2 || pooled.i2 < 50 ? "not-serious" : pooled.i2 < 75 ? "serious" : "very-serious";
    out.precision = pooled.lo < 1 && pooled.hi > 1 ? "serious" : "not-serious";
  }
  return out;
}

export const ANNEX8_HEADERS = [
  "First author, Year",
  "Country",
  "Study Design",
  "Population",
  "Intervention",
  "Comparator",
  "Outcomes measured",
  "Findings",
] as const;

export const ANNEX8_EXTENSIONS = [
  { key: "ext_randomised_n", label: "Randomised N" },
  { key: "ext_follow_up", label: "Follow-up" },
  { key: "ext_registration_id", label: "Registration ID" },
  { key: "ext_funding_source", label: "Funding source" },
  { key: "ext_overall_risk_of_bias", label: "Overall risk of bias" },
  { key: "ext_verification_status", label: "Verification status" },
  { key: "ext_source_pages", label: "Source page per field" },
] as const;

const ANNEX8_SOURCE_FIELDS: { col: string; id: FieldId }[] = [
  { col: "Country", id: "country" },
  { col: "Design", id: "design" },
  { col: "Population", id: "population" },
  { col: "Intervention", id: "intervention" },
  { col: "Comparator", id: "comparator" },
  { col: "Outcomes", id: "primaryOutcome" },
  { col: "Findings", id: "eT" },
];

/** One Annex 8 row (eight Guide columns + extension fields) built from verified extraction values. */
export function annex8Row(
  study: CandidateStudy,
  verification: Verifications,
  appraisal: Record<string, Record<string, DomainAssessment>>,
  activeIds: Set<FieldId>,
) {
  const v = finalValues(study, verification);
  const val = (id: FieldId) => v[id] ?? "—";
  const fields = study.trial ? getExtractedFields(study.trial) : [];
  const sourceOf = (id: FieldId) => fields.find((f) => f.def.id === id)?.def.source ?? "—";
  const verified = [...activeIds].filter((id) => (verification[study.id]?.[id]?.status ?? "pending") !== "pending").length;

  const annex8: string[] = [
    `${study.authors.split(",")[0]}, ${study.year}`,
    (v.country ?? "—").replace(/\s*\([^)]*\)\s*$/, ""),
    val("design"),
    v.lvef ? `${val("population")}; ${v.lvef}` : val("population"),
    val("intervention"),
    val("comparator"),
    val("primaryOutcome"),
    `events ${val("eT")}/${val("nT")} vs ${val("eC")}/${val("nC")}; reported HR ${val("hr")}`,
  ];
  const extensions: string[] = [
    val("randomized"),
    val("followUp"),
    val("registration"),
    val("funding"),
    robOverall(appraisal[study.id]).label,
    `${verified}/${activeIds.size} fields verified`,
    ANNEX8_SOURCE_FIELDS.map((f) => `${f.col}: ${sourceOf(f.id)}`).join("; "),
  ];
  return { annex8, extensions };
}

export function reviewsOnlyNote(n: number) {
  return `${n} systematic review${n === 1 ? "" : "s"} appraised only (not extracted or pooled; RCT-only scope).`;
}

export function csvEscape(s: string | null | undefined) {
  const t = s ?? "";
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
