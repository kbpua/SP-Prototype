import { AMSTAR2_ITEMS, getExtractedFields, ROB2_DOMAINS, type CandidateStudy, type FieldId } from "@/data/mockData";
import {
  finalFieldValue,
  type DomainAssessment,
  type FieldVerification,
  type GradeDomain,
  type GradeLevel,
} from "@/state/ReviewContext";
import { parseRatioWithCi, type PooledResult, type StudyInput } from "./meta";
import { OUTCOME_TYPE_LABELS, outcomeDataKey, type OutcomeMeasure } from "./effectMeasures";

export type Verifications = Record<string, Partial<Record<FieldId, FieldVerification>>>;

export function finalValues(study: CandidateStudy, verification: Verifications, resolvedOnly = false) {
  const out: Partial<Record<FieldId, string | null>> = {};
  if (!study.trial) return out;
  for (const f of getExtractedFields(study.trial)) {
    out[f.def.id] = finalFieldValue(f.extracted, verification[study.id]?.[f.def.id], resolvedOnly);
  }
  return out;
}

function toInt(v: string | null | undefined) {
  if (v == null) return NaN;
  return parseInt(v.replace(/[^\d]/g, ""), 10);
}

export const NO_HR_MESSAGE = "No hazard ratio extracted: not pooled";

function parseMeanSd(v: string | null | undefined) {
  const nums = v?.match(/-?\d+(\.\d+)?/g)?.map(Number);
  return nums && nums.length >= 2 ? { mean: nums[0], sd: nums[1] } : undefined;
}

function parsePair(v: string | null | undefined) {
  const [a, b] = (v ?? "").split("/").map(toInt);
  return { a, b };
}

/**
 * Study inputs for one outcome, using the measure configured for it. A time-to-event outcome
 * is pooled only from an extracted hazard ratio, never from crude event counts.
 */
export function buildStudyInputs(
  studies: CandidateStudy[],
  verification: Verifications,
  resolvedOnly: boolean,
  outcome: OutcomeMeasure | undefined,
) {
  const inputs: StudyInput[] = [];
  const skipped: { study: CandidateStudy; reason: string }[] = [];
  const key = outcome ? outcomeDataKey(outcome) : null;
  for (const s of studies) {
    if (!s.trial || !outcome) continue;
    if (!key) {
      skipped.push({ study: s, reason: "No mock data for this outcome" });
      continue;
    }
    const v = finalValues(s, verification, resolvedOnly);
    const sae = parsePair(v.sae);
    const input: StudyInput = {
      id: s.id,
      label: s.trial.acronym,
      year: s.year,
      nT: toInt(v.nT),
      nC: toInt(v.nC),
      eT: key === "sae" ? sae.a : toInt(v.eT),
      eC: key === "sae" ? sae.b : toInt(v.eC),
    };
    if (!Number.isFinite(input.nT) || !Number.isFinite(input.nC)) {
      skipped.push({ study: s, reason: "Sample sizes rejected or unresolved" });
      continue;
    }
    if (outcome.measure === "HR") {
      input.hr = key === "trialPrimary" && v.hr ? parseRatioWithCi(v.hr) : undefined;
      if (!input.hr) {
        skipped.push({ study: s, reason: NO_HR_MESSAGE });
        continue;
      }
    } else if (outcome.measure === "MD") {
      const t = key === "trialPrimary" ? parseMeanSd(v.mdT) : undefined;
      const c = key === "trialPrimary" ? parseMeanSd(v.mdC) : undefined;
      if (!t || !c) {
        skipped.push({ study: s, reason: "No means and SDs extracted: not pooled" });
        continue;
      }
      input.md = { meanT: t.mean, sdT: t.sd, meanC: c.mean, sdC: c.sd };
    } else if (!Number.isFinite(input.eT) || !Number.isFinite(input.eC)) {
      skipped.push({ study: s, reason: "Event counts rejected or unresolved" });
      continue;
    }
    inputs.push(input);
  }
  return { inputs, skipped };
}

/** Annex 8 "Findings" text for one outcome, built from the values its measure uses. */
export function outcomeFindings(v: Partial<Record<FieldId, string | null>>, outcome: OutcomeMeasure) {
  const val = (id: FieldId) => v[id] ?? "—";
  const key = outcomeDataKey(outcome);
  if (key === "sae") {
    const { a, b } = parsePair(v.sae);
    return `events ${Number.isFinite(a) ? a : "—"}/${val("nT")} vs ${Number.isFinite(b) ? b : "—"}/${val("nC")}`;
  }
  if (key !== "trialPrimary") return "—";
  if (outcome.measure === "HR") return `HR ${val("hr")}; p ${val("p")}`;
  if (outcome.measure === "MD") return `mean (SD) ${val("mdT")}, n ${val("nT")} vs ${val("mdC")}, n ${val("nC")}`;
  return `events ${val("eT")}/${val("nT")} vs ${val("eC")}/${val("nC")}; p ${val("p")}`;
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
  { key: "ext_stakeholder_tag", label: "Stakeholder tag (rule-based)" },
  { key: "ext_resolution_status", label: "Resolution status" },
  { key: "ext_reviewer_agreement", label: "Reviewer agreement (extraction)" },
  { key: "ext_effect_measure", label: "Effect measure" },
  { key: "ext_outcome_type", label: "Outcome type" },
] as const;

function findingsSourceField(outcome: OutcomeMeasure): FieldId {
  if (outcomeDataKey(outcome) === "sae") return "sae";
  return outcome.measure === "HR" ? "hr" : outcome.measure === "MD" ? "mdT" : "eT";
}

/** One Annex 8 row per study and extracted outcome (eight Guide columns + extension fields), resolved values only. */
export function annex8Row(
  study: CandidateStudy,
  verification: Verifications,
  appraisal: Record<string, Record<string, DomainAssessment>>,
  activeIds: Set<FieldId>,
  outcome: OutcomeMeasure,
  extra: { stakeholderTags: string; resolution: string; agreement: string },
) {
  const v = finalValues(study, verification, true);
  const val = (id: FieldId) => v[id] ?? "—";
  const fields = study.trial ? getExtractedFields(study.trial) : [];
  const sourceOf = (id: FieldId) => fields.find((f) => f.def.id === id)?.def.source ?? "—";
  const verified = [...activeIds].filter((id) => verification[study.id]?.[id]).length;
  const isSae = outcomeDataKey(outcome) === "sae";
  const sources: { col: string; id: FieldId }[] = [
    { col: "Country", id: "country" },
    { col: "Design", id: "design" },
    { col: "Population", id: "population" },
    { col: "Intervention", id: "intervention" },
    { col: "Comparator", id: "comparator" },
    ...(isSae ? [] : [{ col: "Outcomes", id: "primaryOutcome" as FieldId }]),
    { col: "Findings", id: findingsSourceField(outcome) },
  ];

  const annex8: string[] = [
    `${study.authors.split(",")[0]}, ${study.year}`,
    (v.country ?? "—").replace(/\s*\([^)]*\)\s*$/, ""),
    val("design"),
    v.lvef ? `${val("population")}; ${v.lvef}` : val("population"),
    val("intervention"),
    val("comparator"),
    isSae ? outcome.outcomeName : val("primaryOutcome"),
    outcomeFindings(v, outcome),
  ];
  const extensions: string[] = [
    val("randomized"),
    val("followUp"),
    val("registration"),
    val("funding"),
    robOverall(appraisal[study.id]).label,
    `${verified}/${activeIds.size} fields resolved`,
    sources.map((f) => `${f.col}: ${sourceOf(f.id)}`).join("; "),
    extra.stakeholderTags,
    extra.resolution,
    extra.agreement,
    `${outcome.measure}${outcome.isPrimary ? " (primary outcome)" : ""}`,
    OUTCOME_TYPE_LABELS[outcome.type],
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
