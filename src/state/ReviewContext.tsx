import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AMSTAR2_ITEMS,
  CANDIDATE_STUDIES,
  ROB2_DOMAINS,
  DEFAULT_REVIEW_CONFIG,
  EXTRACTION_FIELDS,
  INELIGIBILITY_CODES,
  SAMPLE_AMSTAR2,
  SAMPLE_ROB2,
  getExtractedFields,
  isSupportedDesign,
  type CandidateStudy,
  type FieldId,
  type IneligibilityCode,
  type SchemaKey,
  type StudyDesign,
} from "@/data/mockData";
import type { EffectMeasure } from "@/lib/meta";

export type Decision = "include" | "exclude" | "maybe";
export type RobJudgement = "low" | "some" | "high";
export type AmstarAnswer = "yes" | "partial" | "no";
export type FieldStatus = "pending" | "accepted" | "corrected" | "rejected" | "adjudicate";

export interface ScreeningDecision {
  decision: Decision;
  reason?: string;
  code?: IneligibilityCode;
  /** Short text recorded with the "Other" code. */
  codeNote?: string;
  /** True when the analyst changed the system-suggested code. */
  codeEdited?: boolean;
}

export interface DomainAssessment {
  judgement?: RobJudgement | AmstarAnswer;
  note: string;
}

export interface FieldVerification {
  status: FieldStatus;
  value?: string;
  /** Accepted through the batch "Accept high-confidence" action. */
  batch?: boolean;
}

export interface ReviewConfig {
  title: string;
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  studyDesign: string;
  inclusion: string[];
  exclusion: string[];
  exclusionCodes: Record<string, IneligibilityCode>;
  /** Justifications for restrictive criteria (language, publication type). */
  justifications: Record<string, string>;
  schemas: Record<SchemaKey, boolean>;
  effectMeasure: EffectMeasure;
  configured: boolean;
}

export type GradeDomain = "rob" | "consistency" | "precision" | "directness" | "reporting";
export type GradeLevel = "not-serious" | "serious" | "very-serious";
export type GradeCertainty = "high" | "moderate" | "low" | "very-low";

export interface GradeState {
  domains: Partial<Record<GradeDomain, GradeLevel>>;
  overall?: GradeCertainty;
}

export type StageKey = "config" | "screening" | "appraisal" | "extraction" | "synthesis" | "export";

interface ReviewState {
  config: ReviewConfig;
  screening: Record<string, ScreeningDecision>;
  /** Reviewer-edited screening rationales; absent means the system-suggested text is used. */
  rationales: Record<string, string>;
  /** Analyst overrides of the Design chip; absent means the imported design. */
  designs: Record<string, StudyDesign>;
  appraisal: Record<string, Record<string, DomainAssessment>>;
  verification: Record<string, Partial<Record<FieldId, FieldVerification>>>;
  grade: GradeState;
  visited: StageKey[];
}

export interface PrismaCounts {
  identified: number;
  duplicates: number;
  screened: number;
  excluded: number;
  included: number;
  maybe: number;
  undecided: number;
  byCode: Record<IneligibilityCode, number>;
}

const STORAGE_KEY = "hta-prototype-state-v2";

/** Records that enter title/abstract screening (duplicates are removed beforehand). */
export const SCREENABLE_STUDIES = CANDIDATE_STUDIES.filter((c) => !c.duplicateOf);

const initialState: ReviewState = {
  config: {
    ...DEFAULT_REVIEW_CONFIG,
    exclusionCodes: { ...DEFAULT_REVIEW_CONFIG.exclusionCodes },
    justifications: {},
    schemas: { annex8: true, consort: true, prisma: true },
    effectMeasure: "RR",
    configured: false,
  },
  screening: {},
  rationales: {},
  designs: {},
  appraisal: {},
  verification: {},
  grade: { domains: {} },
  visited: [],
};

function loadState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ReviewState>;
      const config = { ...initialState.config, ...saved.config };
      return {
        ...initialState,
        ...saved,
        config: { ...config, schemas: { ...config.schemas, annex8: true } },
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return initialState;
}

interface ReviewContextValue extends ReviewState {
  updateConfig: (patch: Partial<ReviewConfig>) => void;
  setDecision: (id: string, decision: ScreeningDecision | null) => void;
  applySuggestedDecisions: () => void;
  setRationale: (id: string, text: string | null) => void;
  setDesign: (id: string, design: StudyDesign) => void;
  designOf: (study: CandidateStudy) => StudyDesign;
  setDomain: (studyId: string, domainId: string, patch: Partial<DomainAssessment>) => void;
  loadSampleAppraisal: () => void;
  setField: (studyId: string, fieldId: FieldId, v: FieldVerification) => void;
  acceptHighConfidence: (studyIds: string[]) => void;
  setGrade: (patch: Partial<GradeState>) => void;
  markVisited: (stage: StageKey) => void;
  reset: () => void;
  included: CandidateStudy[];
  extractable: CandidateStudy[];
  /** Included records tagged as systematic reviews (appraised only). */
  reviewsOnly: CandidateStudy[];
  prisma: PrismaCounts;
  stageProgress: Record<StageKey, number>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateConfig = useCallback((patch: Partial<ReviewConfig>) => {
    setState((s) => ({ ...s, config: { ...s.config, ...patch } }));
  }, []);

  const setDecision = useCallback((id: string, decision: ScreeningDecision | null) => {
    setState((s) => {
      const screening = { ...s.screening };
      if (decision) screening[id] = decision;
      else delete screening[id];
      return { ...s, screening };
    });
  }, []);

  const setRationale = useCallback((id: string, text: string | null) => {
    setState((s) => {
      const rationales = { ...s.rationales };
      if (text === null) delete rationales[id];
      else rationales[id] = text;
      return { ...s, rationales };
    });
  }, []);

  const setDesign = useCallback((id: string, design: StudyDesign) => {
    setState((s) => {
      const designs = { ...s.designs };
      const study = CANDIDATE_STUDIES.find((c) => c.id === id);
      if (study?.design === design) delete designs[id];
      else designs[id] = design;
      return { ...s, designs };
    });
  }, []);

  const designOf = useCallback(
    (study: CandidateStudy) => state.designs[study.id] ?? study.design,
    [state.designs],
  );

  const applySuggestedDecisions = useCallback(() => {
    setState((s) => {
      const screening = { ...s.screening };
      for (const c of SCREENABLE_STUDIES) {
        const existing = screening[c.id];
        if (existing && existing.decision !== "maybe") continue;
        if (c.suggested.decision === "include") {
          screening[c.id] = { decision: "include" };
        } else {
          const sug = suggestedExclusion(c, s.designs[c.id] ?? c.design);
          screening[c.id] = {
            decision: "exclude",
            reason: c.suggested.reason,
            code: sug.code ?? "Other",
            codeNote: sug.note ?? (sug.code ? undefined : "Not specified"),
          };
        }
      }
      return { ...s, screening };
    });
  }, []);

  const setDomain = useCallback((studyId: string, domainId: string, patch: Partial<DomainAssessment>) => {
    setState((s) => {
      const study = s.appraisal[studyId] ?? {};
      const prev = study[domainId] ?? { note: "" };
      return {
        ...s,
        appraisal: { ...s.appraisal, [studyId]: { ...study, [domainId]: { ...prev, ...patch } } },
      };
    });
  }, []);

  const loadSampleAppraisal = useCallback(() => {
    setState((s) => {
      const appraisal = { ...s.appraisal };
      for (const [id, domains] of [...Object.entries(SAMPLE_ROB2), ...Object.entries(SAMPLE_AMSTAR2)]) {
        if (s.screening[id]?.decision !== "include") continue;
        appraisal[id] = Object.fromEntries(
          Object.entries(domains).map(([d, v]) => [d, { judgement: v.j, note: v.note }]),
        );
      }
      return { ...s, appraisal };
    });
  }, []);

  const setField = useCallback((studyId: string, fieldId: FieldId, v: FieldVerification) => {
    setState((s) => ({
      ...s,
      verification: {
        ...s.verification,
        [studyId]: { ...s.verification[studyId], [fieldId]: v },
      },
    }));
  }, []);

  const acceptHighConfidence = useCallback((studyIds: string[]) => {
    setState((s) => {
      const verification = { ...s.verification };
      const active = activeFieldIds(s.config.schemas);
      for (const id of studyIds) {
        const study = CANDIDATE_STUDIES.find((c) => c.id === id);
        if (!study?.trial) continue;
        const current = { ...verification[id] };
        for (const f of getExtractedFields(study.trial)) {
          if (!active.has(f.def.id)) continue;
          if (f.confidence === "high" && (current[f.def.id]?.status ?? "pending") === "pending") {
            current[f.def.id] = { status: "accepted", batch: true };
          }
        }
        verification[id] = current;
      }
      return { ...s, verification };
    });
  }, []);

  const setGrade = useCallback((patch: Partial<GradeState>) => {
    setState((s) => ({ ...s, grade: { ...s.grade, ...patch } }));
  }, []);

  const markVisited = useCallback((stage: StageKey) => {
    setState((s) => (s.visited.includes(stage) ? s : { ...s, visited: [...s.visited, stage] }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const included = useMemo(
    () =>
      SCREENABLE_STUDIES.filter((c) => state.screening[c.id]?.decision === "include").sort(
        (a, b) => b.relevance - a.relevance,
      ),
    [state.screening],
  );
  const extractable = useMemo(
    () => included.filter((c) => c.trial && (state.designs[c.id] ?? c.design) === "RCT"),
    [included, state.designs],
  );
  const reviewsOnly = useMemo(
    () => included.filter((c) => usesAmstar(c, state.designs)),
    [included, state.designs],
  );

  const prisma = useMemo<PrismaCounts>(() => {
    const byCode = Object.fromEntries(INELIGIBILITY_CODES.map((c) => [c.code, 0])) as Record<IneligibilityCode, number>;
    const c = { include: 0, exclude: 0, maybe: 0, undecided: 0 };
    for (const s of SCREENABLE_STUDIES) {
      const d = state.screening[s.id];
      if (!d) c.undecided++;
      else c[d.decision]++;
      if (d?.decision === "exclude") byCode[d.code ?? "Other"]++;
    }
    return {
      identified: CANDIDATE_STUDIES.length,
      duplicates: CANDIDATE_STUDIES.length - SCREENABLE_STUDIES.length,
      screened: SCREENABLE_STUDIES.length,
      excluded: c.exclude,
      included: c.include,
      maybe: c.maybe,
      undecided: c.undecided,
      byCode,
    };
  }, [state.screening]);

  const stageProgress = useMemo<Record<StageKey, number>>(() => {
    const decided = prisma.included + prisma.excluded;

    const appraisalTotal = included.reduce((acc, c) => acc + appraisalItemCount(c, state.designs), 0);
    const appraisalDone = included.reduce((acc, c) => {
      const a = state.appraisal[c.id] ?? {};
      return acc + Object.values(a).filter((d) => d.judgement).length;
    }, 0);

    const active = activeFieldIds(state.config.schemas);
    const fieldTotal = extractable.length * active.size;
    const fieldDone = extractable.reduce((acc, c) => {
      const v = state.verification[c.id] ?? {};
      return (
        acc +
        (Object.entries(v) as [FieldId, FieldVerification | undefined][]).filter(
          ([id, f]) => active.has(id) && f && f.status !== "pending",
        ).length
      );
    }, 0);

    return {
      config: state.config.configured ? 100 : 0,
      screening: Math.round((decided / prisma.screened) * 100),
      appraisal: appraisalTotal ? Math.min(100, Math.round((appraisalDone / appraisalTotal) * 100)) : 0,
      extraction: fieldTotal ? Math.round((fieldDone / fieldTotal) * 100) : 0,
      synthesis: state.visited.includes("synthesis") ? 100 : 0,
      export: state.visited.includes("export") ? 100 : 0,
    };
  }, [state, included, extractable, prisma]);

  const value: ReviewContextValue = {
    ...state,
    updateConfig,
    setDecision,
    applySuggestedDecisions,
    setRationale,
    setDesign,
    designOf,
    setDomain,
    loadSampleAppraisal,
    setField,
    acceptHighConfidence,
    setGrade,
    markVisited,
    reset,
    included,
    extractable,
    reviewsOnly,
    prisma,
    stageProgress,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within ReviewProvider");
  return ctx;
}

/** Extraction fields covered by the schemas selected in configuration. */
export function activeFieldIds(schemas: Record<SchemaKey, boolean>): Set<FieldId> {
  const any = Object.values(schemas).some(Boolean);
  return new Set(
    EXTRACTION_FIELDS.filter((f) => !any || f.schemas.some((s) => schemas[s.key])).map((f) => f.id),
  );
}

/**
 * Ineligibility code the system pre-selects when a record is excluded.
 * An analyst-changed Design chip takes precedence over the record's matched criterion.
 */
export function suggestedExclusion(
  study: CandidateStudy,
  design: StudyDesign,
): { code?: IneligibilityCode; note?: string } {
  const designChanged = design !== study.design;
  if (designChanged && design === "Conference abstract") {
    return { code: "Other", note: "Publication type: conference abstract" };
  }
  if (designChanged && !isSupportedDesign(design)) return { code: "S" };
  if (study.suggested.code) return { code: study.suggested.code, note: study.suggested.codeNote };
  if (design === "Conference abstract") return { code: "Other", note: "Publication type: conference abstract" };
  if (!isSupportedDesign(design)) return { code: "S" };
  return {};
}

export function usesAmstar(study: CandidateStudy, designs?: Record<string, StudyDesign>) {
  return (designs?.[study.id] ?? study.design) === "Systematic review";
}

export function appraisalItemCount(study: CandidateStudy, designs?: Record<string, StudyDesign>) {
  return usesAmstar(study, designs) ? AMSTAR2_ITEMS.length : ROB2_DOMAINS.length;
}

/** Final value of a field after human verification (null when rejected). */
export function finalFieldValue(
  extracted: string,
  v: FieldVerification | undefined,
): string | null {
  if (!v) return extracted;
  if (v.status === "rejected") return null;
  if (v.status === "corrected") return v.value ?? extracted;
  return extracted;
}
