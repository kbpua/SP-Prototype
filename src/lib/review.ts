import { getExtractedFields, ROB2_DOMAINS, type CandidateStudy, type FieldId } from "@/data/mockData";
import { finalFieldValue, type DomainAssessment, type FieldVerification } from "@/state/ReviewContext";
import { parseRatioWithCi, type StudyInput } from "./meta";

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
