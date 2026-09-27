import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AMSTAR2_ITEMS,
  CANDIDATE_STUDIES,
  ROB2_DOMAINS,
  DEFAULT_REVIEW_CONFIG,
  EXTRACTION_FIELDS,
  SAMPLE_ROB2,
  getExtractedFields,
  type CandidateStudy,
  type FieldId,
  type SchemaKey,
} from "@/data/mockData";
import type { EffectMeasure } from "@/lib/meta";

export type Decision = "include" | "exclude" | "maybe";
export type RobJudgement = "low" | "some" | "high";
export type AmstarAnswer = "yes" | "partial" | "no";
export type FieldStatus = "pending" | "accepted" | "corrected" | "rejected" | "adjudicate";

export interface ScreeningDecision {
  decision: Decision;
  reason?: string;
}

export interface DomainAssessment {
  judgement?: RobJudgement | AmstarAnswer;
  note: string;
}

export interface FieldVerification {
  status: FieldStatus;
  value?: string;
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
  schemas: Record<SchemaKey, boolean>;
  effectMeasure: EffectMeasure;
  configured: boolean;
}

export type StageKey = "config" | "screening" | "appraisal" | "extraction" | "synthesis" | "export";

interface ReviewState {
  config: ReviewConfig;
  screening: Record<string, ScreeningDecision>;
  /** Reviewer-edited screening rationales; absent means the AI text is used. */
  rationales: Record<string, string>;
  appraisal: Record<string, Record<string, DomainAssessment>>;
  verification: Record<string, Partial<Record<FieldId, FieldVerification>>>;
  visited: StageKey[];
}

const STORAGE_KEY = "hta-prototype-state-v1";

const initialState: ReviewState = {
  config: {
    ...DEFAULT_REVIEW_CONFIG,
    schemas: { annex8: true, consort: true, prisma: true },
    effectMeasure: "RR",
    configured: false,
  },
  screening: {},
  rationales: {},
  appraisal: {},
  verification: {},
  visited: [],
};

function loadState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
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
  setDomain: (studyId: string, domainId: string, patch: Partial<DomainAssessment>) => void;
  loadSampleAppraisal: () => void;
  setField: (studyId: string, fieldId: FieldId, v: FieldVerification) => void;
  acceptHighConfidence: (studyIds: string[]) => void;
  markVisited: (stage: StageKey) => void;
  reset: () => void;
  included: CandidateStudy[];
  extractable: CandidateStudy[];
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

  const applySuggestedDecisions = useCallback(() => {
    setState((s) => {
      const screening = { ...s.screening };
      for (const c of CANDIDATE_STUDIES) {
        const existing = screening[c.id];
        if (existing?.decision === "exclude" && !existing.reason && c.suggested.decision === "exclude") {
          screening[c.id] = { decision: "exclude", reason: c.suggested.reason };
        } else if (!existing || existing.decision === "maybe") {
          screening[c.id] = { decision: c.suggested.decision, reason: c.suggested.reason };
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
      for (const [id, domains] of Object.entries(SAMPLE_ROB2)) {
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
            current[f.def.id] = { status: "accepted" };
          }
        }
        verification[id] = current;
      }
      return { ...s, verification };
    });
  }, []);

  const markVisited = useCallback((stage: StageKey) => {
    setState((s) => (s.visited.includes(stage) ? s : { ...s, visited: [...s.visited, stage] }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const included = useMemo(
    () =>
      CANDIDATE_STUDIES.filter((c) => state.screening[c.id]?.decision === "include").sort(
        (a, b) => b.relevance - a.relevance,
      ),
    [state.screening],
  );
  const extractable = useMemo(() => included.filter((c) => c.trial), [included]);

  const stageProgress = useMemo<Record<StageKey, number>>(() => {
    const decided = CANDIDATE_STUDIES.filter((c) => {
      const d = state.screening[c.id]?.decision;
      return d === "include" || d === "exclude";
    }).length;

    const appraisalTotal = included.reduce((acc, c) => acc + appraisalItemCount(c), 0);
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
      screening: Math.round((decided / CANDIDATE_STUDIES.length) * 100),
      appraisal: appraisalTotal ? Math.min(100, Math.round((appraisalDone / appraisalTotal) * 100)) : 0,
      extraction: fieldTotal ? Math.round((fieldDone / fieldTotal) * 100) : 0,
      synthesis: state.visited.includes("synthesis") ? 100 : 0,
      export: state.visited.includes("export") ? 100 : 0,
    };
  }, [state, included, extractable]);

  const value: ReviewContextValue = {
    ...state,
    updateConfig,
    setDecision,
    applySuggestedDecisions,
    setRationale,
    setDomain,
    loadSampleAppraisal,
    setField,
    acceptHighConfidence,
    markVisited,
    reset,
    included,
    extractable,
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

export function usesAmstar(study: CandidateStudy) {
  return study.design === "Systematic review";
}

export function appraisalItemCount(study: CandidateStudy) {
  return usesAmstar(study) ? AMSTAR2_ITEMS.length : ROB2_DOMAINS.length;
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
