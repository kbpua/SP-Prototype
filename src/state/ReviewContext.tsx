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
import { PROTOTYPE_CONFIG } from "@/config/prototypeConfig";
import {
  DEFAULT_STAKEHOLDER_CATEGORIES,
  suggestTag,
  type StakeholderCategoryId,
  type SuggestedTag,
} from "@/config/stakeholderCategories";
import { cohenKappa } from "@/lib/agreement";
import type { EffectMeasure } from "@/lib/meta";
import {
  MEASURE_NAMES,
  OUTCOME_FIELD_IDS,
  OUTCOME_TYPE_LABELS,
  SEED_EFFECT_MEASURES,
  defaultMeasureFor,
  isValidMeasure,
  outcomeFieldIds,
  reconcileOutcomes,
  type EffectMeasureChange,
  type OutcomeMeasure,
  type OutcomeType,
} from "@/lib/effectMeasures";

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
  /** True when the reviewer changed the system-suggested code. */
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

export type TagStatus = "accepted" | "corrected" | "removed";

export interface TagDecision {
  status: TagStatus;
  /** Replacement tag text when corrected. */
  value?: string;
}

// ---------------------------------------------------------------------------
// Dual-reviewer model (screening and extraction only)
// ---------------------------------------------------------------------------

export type ReviewerId = "A" | "B";
export type Role = ReviewerId | "adjudicator";

export const ROLE_LABELS: Record<Role, string> = {
  A: "Reviewer A",
  B: "Reviewer B",
  adjudicator: "Adjudicator",
};

type Stamped<T> = T & { at: string };
export type Resolution<T> = T & { at: string; resolver: Role };

export interface DualRecord<T> {
  A?: Stamped<T>;
  B?: Stamped<T>;
  resolved?: Resolution<T>;
}

export type DualStatus = "open" | "partial" | "agreed" | "conflict" | "resolved";

export function dualStatus<T>(rec: DualRecord<T> | undefined, agree: (a: T, b: T) => boolean): DualStatus {
  if (!rec) return "open";
  if (rec.resolved) return "resolved";
  if (rec.A && rec.B) return agree(rec.A, rec.B) ? "agreed" : "conflict";
  if (rec.A || rec.B) return "partial";
  return "open";
}

/** Final value: the resolution, or the shared decision when both reviewers agree. */
export function dualFinal<T>(rec: DualRecord<T> | undefined, agree: (a: T, b: T) => boolean): T | undefined {
  if (!rec) return undefined;
  if (rec.resolved) return rec.resolved;
  if (rec.A && rec.B && agree(rec.A, rec.B)) return rec.A;
  return undefined;
}

/** Whether both reviewers have committed (each can then see the other's decision). */
export const bothCommitted = <T,>(rec: DualRecord<T> | undefined) => !!(rec?.A && rec?.B);

const norm = (s?: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const screeningAgree = (a: ScreeningDecision, b: ScreeningDecision) =>
  a.decision === b.decision && (a.decision !== "exclude" || (a.code ?? "Other") === (b.code ?? "Other"));

export const fieldAgree = (a: FieldVerification, b: FieldVerification) =>
  a.status === b.status && a.status !== "adjudicate" && (a.status !== "corrected" || norm(a.value) === norm(b.value));

export const tagAgree = (a: TagDecision, b: TagDecision) =>
  a.status === b.status && (a.status !== "corrected" || norm(a.value) === norm(b.value));

/** "code" when both reviewers excluded with different codes; "decision" when decisions differ. */
export function screeningConflictKind(rec: DualRecord<ScreeningDecision> | undefined): "decision" | "code" | null {
  if (!rec?.A || !rec?.B || screeningAgree(rec.A, rec.B)) return null;
  return rec.A.decision === rec.B.decision ? "code" : "decision";
}

/** Role allowed to resolve conflicts under the configured tie-break rule. */
export const RESOLVER_ROLE: Role = PROTOTYPE_CONFIG.tieBreak === "reviewerA" ? "A" : "adjudicator";

// ---------------------------------------------------------------------------

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
  stakeholderCategories: StakeholderCategoryId[];
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

type FieldMap<T> = Record<string, Partial<Record<FieldId, DualRecord<T>>>>;

interface ReviewState {
  config: ReviewConfig;
  /** Per-outcome type and effect measure, keyed by outcome id (reconciled against the Outcomes text). */
  effectMeasures: OutcomeMeasure[];
  effectMeasureLog: EffectMeasureChange[];
  role: Role;
  roleNoteDismissed: boolean;
  screeningDual: Record<string, DualRecord<ScreeningDecision>>;
  /** Reviewer-edited screening rationales; absent means the system-suggested text is used. */
  rationales: Record<string, string>;
  /** Analyst overrides of the Design chip; absent means the imported design. */
  designs: Record<string, StudyDesign>;
  appraisal: Record<string, Record<string, DomainAssessment>>;
  fieldDual: FieldMap<FieldVerification>;
  tagDual: FieldMap<TagDecision>;
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

export interface AgreementStats {
  /** Records or fields in the stage. */
  items: number;
  /** Items both reviewers have committed. */
  paired: number;
  conflicts: number;
  /** Screening only: both excluded with different codes. */
  codeMismatches: number;
  openConflicts: number;
  resolved: number;
  /** Percent agreement on decision categories (null until any item is paired). */
  percent: number | null;
  kappa: number | null;
}

export interface TagItem extends SuggestedTag {
  studyId: string;
  status: DualStatus;
  final?: TagDecision;
}

const STORAGE_KEY = "hta-prototype-state-v3";

/** Records that enter title/abstract screening (duplicates are removed beforehand). */
export const SCREENABLE_STUDIES = CANDIDATE_STUDIES.filter((c) => !c.duplicateOf);

const initialState: ReviewState = {
  config: {
    ...DEFAULT_REVIEW_CONFIG,
    exclusionCodes: { ...DEFAULT_REVIEW_CONFIG.exclusionCodes },
    justifications: {},
    schemas: { annex8: true, consort: true, prisma: true },
    stakeholderCategories: [...DEFAULT_STAKEHOLDER_CATEGORIES],
    configured: false,
  },
  effectMeasures: SEED_EFFECT_MEASURES.map((m) => ({ ...m })),
  effectMeasureLog: [],
  role: "A",
  roleNoteDismissed: false,
  screeningDual: {},
  rationales: {},
  designs: {},
  appraisal: {},
  fieldDual: {},
  tagDual: {},
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

/** Demo shortcut: Reviewer B departs from the reference decision on these records. */
const DEMO_SCREENING_B: Record<string, ScreeningDecision> = {
  s09: { decision: "include" },
  s07: { decision: "maybe" },
  s12: { decision: "exclude", code: "S", reason: "Wrong study design" },
};

/** Demo shortcut: Reviewer B departs from the reference extraction decision on these fields. */
const DEMO_FIELD_B: Partial<Record<FieldId, FieldVerification>> = {
  funding: { status: "rejected" },
  hr: { status: "corrected", value: "0.72 (0.61–0.87)" },
  female: { status: "corrected", value: "24.2" },
};

const now = () => new Date().toISOString();

interface ReviewContextValue {
  config: ReviewConfig;
  /** One row per outcome in the Outcomes field; exactly one is primary. */
  effectMeasures: OutcomeMeasure[];
  primaryOutcome: OutcomeMeasure | undefined;
  effectMeasureLog: EffectMeasureChange[];
  /** True once any reviewer has committed an extraction decision. */
  extractionStarted: boolean;
  setOutcomeMeasure: (
    outcomeId: string,
    patch: { type?: OutcomeType; measure?: EffectMeasure; isPrimary?: boolean },
  ) => void;
  role: Role;
  roleNoteDismissed: boolean;
  screeningDual: Record<string, DualRecord<ScreeningDecision>>;
  rationales: Record<string, string>;
  designs: Record<string, StudyDesign>;
  appraisal: Record<string, Record<string, DomainAssessment>>;
  fieldDual: FieldMap<FieldVerification>;
  tagDual: FieldMap<TagDecision>;
  grade: GradeState;
  visited: StageKey[];
  /** Final screening decisions (agreed or resolved). */
  screening: Record<string, ScreeningDecision>;
  /** Final field decisions (agreed or resolved); unresolved fields are absent. */
  verification: Record<string, Partial<Record<FieldId, FieldVerification>>>;
  setRole: (role: Role) => void;
  dismissRoleNote: () => void;
  updateConfig: (patch: Partial<ReviewConfig>) => void;
  /** Commits (or withdraws, with null) the current reviewer's screening decision. */
  setDecision: (id: string, decision: ScreeningDecision | null) => void;
  resolveScreening: (id: string, decision: ScreeningDecision) => void;
  applySuggestedDecisions: () => void;
  setRationale: (id: string, text: string | null) => void;
  setDesign: (id: string, design: StudyDesign) => void;
  designOf: (study: CandidateStudy) => StudyDesign;
  setDomain: (studyId: string, domainId: string, patch: Partial<DomainAssessment>) => void;
  loadSampleAppraisal: () => void;
  /** Commits the current reviewer's field decision; status "pending" withdraws it. */
  setField: (studyId: string, fieldId: FieldId, v: FieldVerification) => void;
  resolveField: (studyId: string, fieldId: FieldId, v: FieldVerification) => void;
  setTag: (studyId: string, fieldId: FieldId, v: TagDecision | null) => void;
  resolveTag: (studyId: string, fieldId: FieldId, v: TagDecision) => void;
  acceptHighConfidence: (studyIds: string[]) => void;
  applyReferenceExtraction: () => void;
  setGrade: (patch: Partial<GradeState>) => void;
  markVisited: (stage: StageKey) => void;
  reset: () => void;
  included: CandidateStudy[];
  extractable: CandidateStudy[];
  /** Included records tagged as systematic reviews (appraised only; out-of-scope mocks). */
  reviewsOnly: CandidateStudy[];
  prisma: PrismaCounts;
  tags: TagItem[];
  screeningAgreement: AgreementStats;
  extractionAgreement: AgreementStats;
  /** Fields (data fields only) resolved across extractable studies. */
  fieldsResolved: { resolved: number; total: number };
  stageProgress: Record<StageKey, number>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setRole = useCallback((role: Role) => setState((s) => ({ ...s, role })), []);
  const dismissRoleNote = useCallback(() => setState((s) => ({ ...s, roleNoteDismissed: true })), []);

  const updateConfig = useCallback((patch: Partial<ReviewConfig>) => {
    setState((s) => ({ ...s, config: { ...s.config, ...patch } }));
  }, []);

  const setOutcomeMeasure = useCallback(
    (outcomeId: string, patch: { type?: OutcomeType; measure?: EffectMeasure; isPrimary?: boolean }) => {
      setState((s) => {
        const rows = reconcileOutcomes(s.config.outcome, s.effectMeasures);
        const prev = rows.find((r) => r.outcomeId === outcomeId);
        if (!prev) return s;
        let next: OutcomeMeasure = { ...prev };
        if (patch.type && patch.type !== prev.type) {
          next = { ...next, type: patch.type, measure: defaultMeasureFor(patch.type), measureSource: "suggested" };
        }
        if (patch.measure && patch.measure !== next.measure && isValidMeasure(next.type, patch.measure)) {
          next = { ...next, measure: patch.measure, measureSource: "analyst" };
        }
        const updated = rows.map((r) => {
          if (r.outcomeId === outcomeId) return { ...next, isPrimary: patch.isPrimary ? true : r.isPrimary };
          return patch.isPrimary ? { ...r, isPrimary: false } : r;
        });
        const log = [...s.effectMeasureLog];
        if (hasExtractionStarted(s)) {
          const entry = { outcomeId, outcomeName: prev.outcomeName, role: ROLE_LABELS[s.role], at: now(), note: "changed after extraction started" as const };
          if (next.type !== prev.type)
            log.push({ ...entry, setting: "outcome type", previous: OUTCOME_TYPE_LABELS[prev.type], next: OUTCOME_TYPE_LABELS[next.type] });
          if (next.measure !== prev.measure)
            log.push({
              ...entry,
              setting: "effect measure",
              previous: `${prev.measure} (${MEASURE_NAMES[prev.measure]})`,
              next: `${next.measure} (${MEASURE_NAMES[next.measure]})`,
            });
        }
        const others = s.effectMeasures.filter((m) => !updated.some((u) => u.outcomeId === m.outcomeId));
        return { ...s, effectMeasures: [...updated, ...others.map((o) => ({ ...o, isPrimary: false }))], effectMeasureLog: log };
      });
    },
    [],
  );

  const setDecision = useCallback((id: string, decision: ScreeningDecision | null) => {
    setState((s) => {
      if (s.role === "adjudicator") return s;
      const reviewer = s.role;
      const rec = { ...s.screeningDual[id] };
      if (decision) rec[reviewer] = { ...decision, at: now() };
      else delete rec[reviewer];
      return { ...s, screeningDual: { ...s.screeningDual, [id]: rec } };
    });
  }, []);

  const resolveScreening = useCallback((id: string, decision: ScreeningDecision) => {
    setState((s) => ({
      ...s,
      screeningDual: {
        ...s.screeningDual,
        [id]: { ...s.screeningDual[id], resolved: { ...decision, at: now(), resolver: s.role } },
      },
    }));
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
      const screeningDual = { ...s.screeningDual };
      for (const c of SCREENABLE_STUDIES) {
        const rec = { ...screeningDual[c.id] };
        let reference: ScreeningDecision;
        if (c.suggested.decision === "include") {
          reference = { decision: "include" };
        } else {
          const sug = suggestedExclusion(c, s.designs[c.id] ?? c.design);
          reference = {
            decision: "exclude",
            reason: c.suggested.reason,
            code: sug.code ?? "Other",
            codeNote: sug.note ?? (sug.code ? undefined : "Not specified"),
          };
        }
        if (!rec.A) rec.A = { ...reference, at: now() };
        if (!rec.B) rec.B = { ...(DEMO_SCREENING_B[c.id] ?? reference), at: now() };
        screeningDual[c.id] = rec;
      }
      return { ...s, screeningDual };
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

  const finalScreening = useMemo(() => {
    const out: Record<string, ScreeningDecision> = {};
    for (const c of SCREENABLE_STUDIES) {
      const f = dualFinal(state.screeningDual[c.id], screeningAgree);
      if (f) out[c.id] = f;
    }
    return out;
  }, [state.screeningDual]);

  const loadSampleAppraisal = useCallback(() => {
    setState((s) => {
      const appraisal = { ...s.appraisal };
      const samples = PROTOTYPE_CONFIG.showOutOfScopeMocks
        ? [...Object.entries(SAMPLE_ROB2), ...Object.entries(SAMPLE_AMSTAR2)]
        : Object.entries(SAMPLE_ROB2);
      for (const [id, domains] of samples) {
        if (dualFinal(s.screeningDual[id], screeningAgree)?.decision !== "include") continue;
        appraisal[id] = Object.fromEntries(
          Object.entries(domains).map(([d, v]) => [d, { judgement: v.j, note: v.note }]),
        );
      }
      return { ...s, appraisal };
    });
  }, []);

  const setField = useCallback((studyId: string, fieldId: FieldId, v: FieldVerification) => {
    setState((s) => {
      if (s.role === "adjudicator") return s;
      const reviewer = s.role;
      const rec = { ...s.fieldDual[studyId]?.[fieldId] };
      if (v.status === "pending") delete rec[reviewer];
      else rec[reviewer] = { ...v, at: now() };
      return { ...s, fieldDual: { ...s.fieldDual, [studyId]: { ...s.fieldDual[studyId], [fieldId]: rec } } };
    });
  }, []);

  const resolveField = useCallback((studyId: string, fieldId: FieldId, v: FieldVerification) => {
    setState((s) => {
      const rec = { ...s.fieldDual[studyId]?.[fieldId], resolved: { ...v, at: now(), resolver: s.role } };
      return { ...s, fieldDual: { ...s.fieldDual, [studyId]: { ...s.fieldDual[studyId], [fieldId]: rec } } };
    });
  }, []);

  const setTag = useCallback((studyId: string, fieldId: FieldId, v: TagDecision | null) => {
    setState((s) => {
      if (s.role === "adjudicator") return s;
      const reviewer = s.role;
      const rec = { ...s.tagDual[studyId]?.[fieldId] };
      if (v) rec[reviewer] = { ...v, at: now() };
      else delete rec[reviewer];
      return { ...s, tagDual: { ...s.tagDual, [studyId]: { ...s.tagDual[studyId], [fieldId]: rec } } };
    });
  }, []);

  const resolveTag = useCallback((studyId: string, fieldId: FieldId, v: TagDecision) => {
    setState((s) => {
      const rec = { ...s.tagDual[studyId]?.[fieldId], resolved: { ...v, at: now(), resolver: s.role } };
      return { ...s, tagDual: { ...s.tagDual, [studyId]: { ...s.tagDual[studyId], [fieldId]: rec } } };
    });
  }, []);

  const acceptHighConfidence = useCallback((studyIds: string[]) => {
    setState((s) => {
      if (s.role === "adjudicator") return s;
      const reviewer = s.role;
      const fieldDual = { ...s.fieldDual };
      const active = activeFieldIds(s.config.schemas, reconcileOutcomes(s.config.outcome, s.effectMeasures));
      for (const id of studyIds) {
        const study = CANDIDATE_STUDIES.find((c) => c.id === id);
        if (!study?.trial) continue;
        const current = { ...fieldDual[id] };
        for (const f of getExtractedFields(study.trial)) {
          if (!active.has(f.def.id)) continue;
          const rec = current[f.def.id];
          if (f.confidence === "high" && !rec?.[reviewer]) {
            current[f.def.id] = { ...rec, [reviewer]: { status: "accepted", batch: true, at: now() } };
          }
        }
        fieldDual[id] = current;
      }
      return { ...s, fieldDual };
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
      SCREENABLE_STUDIES.filter((c) => finalScreening[c.id]?.decision === "include").sort(
        (a, b) => b.relevance - a.relevance,
      ),
    [finalScreening],
  );
  const extractable = useMemo(
    () => included.filter((c) => c.trial && (state.designs[c.id] ?? c.design) === "RCT"),
    [included, state.designs],
  );
  const reviewsOnly = useMemo(
    () => included.filter((c) => usesAmstar(c, state.designs)),
    [included, state.designs],
  );

  const applyReferenceExtraction = useCallback(() => {
    setState((s) => {
      const fieldDual = { ...s.fieldDual };
      const tagDual = { ...s.tagDual };
      const active = activeFieldIds(s.config.schemas, reconcileOutcomes(s.config.outcome, s.effectMeasures));
      for (const study of extractable) {
        if (!study.trial) continue;
        const fields = { ...fieldDual[study.id] };
        const tagsRec = { ...tagDual[study.id] };
        for (const f of getExtractedFields(study.trial)) {
          if (!active.has(f.def.id)) continue;
          const reference: FieldVerification =
            f.extracted === f.truth ? { status: "accepted" } : { status: "corrected", value: f.truth };
          const rec = { ...fields[f.def.id] };
          if (!rec.A) rec.A = { ...reference, at: now() };
          if (!rec.B) rec.B = { ...(DEMO_FIELD_B[f.def.id] ?? reference), at: now() };
          fields[f.def.id] = rec;
          if (suggestTag(f.def.id, f.extracted, s.config.stakeholderCategories)) {
            const t = { ...tagsRec[f.def.id] };
            if (!t.A) t.A = { status: "accepted", at: now() };
            if (!t.B) t.B = { status: "accepted", at: now() };
            tagsRec[f.def.id] = t;
          }
        }
        fieldDual[study.id] = fields;
        tagDual[study.id] = tagsRec;
      }
      return { ...s, fieldDual, tagDual };
    });
  }, [extractable]);

  const effectMeasures = useMemo(
    () => reconcileOutcomes(state.config.outcome, state.effectMeasures),
    [state.config.outcome, state.effectMeasures],
  );
  const extractionStarted = useMemo(() => hasExtractionStarted(state), [state]);
  const activeIds = useMemo(
    () => activeFieldIds(state.config.schemas, effectMeasures),
    [state.config.schemas, effectMeasures],
  );

  const finalVerification = useMemo(() => {
    const out: Record<string, Partial<Record<FieldId, FieldVerification>>> = {};
    for (const [studyId, fields] of Object.entries(state.fieldDual)) {
      const m: Partial<Record<FieldId, FieldVerification>> = {};
      for (const [fid, rec] of Object.entries(fields) as [FieldId, DualRecord<FieldVerification>][]) {
        const f = dualFinal(rec, fieldAgree);
        if (f) m[fid] = { status: f.status, value: f.value, batch: !rec.resolved && !!rec.A?.batch && !!rec.B?.batch };
      }
      out[studyId] = m;
    }
    return out;
  }, [state.fieldDual]);

  const tags = useMemo<TagItem[]>(() => {
    const out: TagItem[] = [];
    for (const study of extractable) {
      if (!study.trial) continue;
      for (const f of getExtractedFields(study.trial)) {
        if (!activeIds.has(f.def.id)) continue;
        const t = suggestTag(f.def.id, f.extracted, state.config.stakeholderCategories);
        if (!t) continue;
        const rec = state.tagDual[study.id]?.[f.def.id];
        out.push({ ...t, studyId: study.id, status: dualStatus(rec, tagAgree), final: dualFinal(rec, tagAgree) });
      }
    }
    return out;
  }, [extractable, activeIds, state.config.stakeholderCategories, state.tagDual]);

  const prisma = useMemo<PrismaCounts>(() => {
    const byCode = Object.fromEntries(INELIGIBILITY_CODES.map((c) => [c.code, 0])) as Record<IneligibilityCode, number>;
    const c = { include: 0, exclude: 0, maybe: 0, undecided: 0 };
    for (const s of SCREENABLE_STUDIES) {
      const d = finalScreening[s.id];
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
  }, [finalScreening]);

  const screeningAgreement = useMemo<AgreementStats>(() => {
    const pairs: [string, string][] = [];
    let conflicts = 0;
    let codeMismatches = 0;
    let openConflicts = 0;
    let resolved = 0;
    for (const s of SCREENABLE_STUDIES) {
      const rec = state.screeningDual[s.id];
      if (!rec?.A || !rec?.B) continue;
      pairs.push([rec.A.decision, rec.B.decision]);
      const kind = screeningConflictKind(rec);
      if (kind === "decision") conflicts++;
      if (kind === "code") codeMismatches++;
      if (kind && rec.resolved) resolved++;
      if (kind && !rec.resolved) openConflicts++;
    }
    const k = cohenKappa(pairs);
    return {
      items: SCREENABLE_STUDIES.length,
      paired: pairs.length,
      conflicts,
      codeMismatches,
      openConflicts,
      resolved,
      percent: k.percent,
      kappa: k.kappa,
    };
  }, [state.screeningDual]);

  const extractionAgreement = useMemo<AgreementStats>(() => {
    const pairs: [string, string][] = [];
    let items = 0;
    let conflicts = 0;
    let openConflicts = 0;
    let resolved = 0;
    const visit = <T extends { status: string }>(rec: DualRecord<T> | undefined, agree: (a: T, b: T) => boolean) => {
      items++;
      if (!rec?.A || !rec?.B) return;
      pairs.push([rec.A.status, rec.B.status]);
      if (!agree(rec.A, rec.B)) {
        conflicts++;
        if (rec.resolved) resolved++;
        else openConflicts++;
      }
    };
    for (const study of extractable) {
      for (const id of activeIds) visit(state.fieldDual[study.id]?.[id], fieldAgree);
    }
    for (const t of tags) visit(state.tagDual[t.studyId]?.[t.fieldId], tagAgree);
    const k = cohenKappa(pairs);
    return {
      items,
      paired: pairs.length,
      conflicts,
      codeMismatches: 0,
      openConflicts,
      resolved,
      percent: k.percent,
      kappa: k.kappa,
    };
  }, [extractable, activeIds, tags, state.fieldDual, state.tagDual]);

  const fieldsResolved = useMemo(() => {
    const total = extractable.length * activeIds.size;
    const resolved = extractable.reduce(
      (acc, c) => acc + [...activeIds].filter((id) => finalVerification[c.id]?.[id]).length,
      0,
    );
    return { resolved, total };
  }, [extractable, activeIds, finalVerification]);

  const stageProgress = useMemo<Record<StageKey, number>>(() => {
    const decided = prisma.included + prisma.excluded;

    const appraisalTotal = included.reduce((acc, c) => acc + appraisalItemCount(c, state.designs), 0);
    const appraisalDone = included.reduce((acc, c) => {
      const a = state.appraisal[c.id] ?? {};
      return acc + Object.values(a).filter((d) => d.judgement).length;
    }, 0);

    const itemTotal = fieldsResolved.total + tags.length;
    const itemDone = fieldsResolved.resolved + tags.filter((t) => t.final).length;

    return {
      config: state.config.configured ? 100 : 0,
      screening: Math.round((decided / prisma.screened) * 100),
      appraisal: appraisalTotal ? Math.min(100, Math.round((appraisalDone / appraisalTotal) * 100)) : 0,
      extraction: itemTotal ? Math.round((itemDone / itemTotal) * 100) : 0,
      synthesis: state.visited.includes("synthesis") ? 100 : 0,
      export: state.visited.includes("export") ? 100 : 0,
    };
  }, [state, included, prisma, fieldsResolved, tags]);

  const value: ReviewContextValue = {
    ...state,
    effectMeasures,
    primaryOutcome: effectMeasures.find((m) => m.isPrimary),
    extractionStarted,
    setOutcomeMeasure,
    screening: finalScreening,
    verification: finalVerification,
    setRole,
    dismissRoleNote,
    updateConfig,
    setDecision,
    resolveScreening,
    applySuggestedDecisions,
    setRationale,
    setDesign,
    designOf,
    setDomain,
    loadSampleAppraisal,
    setField,
    resolveField,
    setTag,
    resolveTag,
    acceptHighConfidence,
    applyReferenceExtraction,
    setGrade,
    markVisited,
    reset,
    included,
    extractable,
    reviewsOnly,
    prisma,
    tags,
    screeningAgreement,
    extractionAgreement,
    fieldsResolved,
    stageProgress,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within ReviewProvider");
  return ctx;
}

/**
 * Extraction fields covered by the selected schemas. Outcome-result fields follow each outcome's
 * configured effect measure (HR rows need the hazard ratio, RR/OR rows events per arm, MD rows means and SDs).
 */
export function activeFieldIds(schemas: Record<SchemaKey, boolean>, outcomes: OutcomeMeasure[]): Set<FieldId> {
  const any = Object.values(schemas).some(Boolean);
  const needed = outcomeFieldIds(outcomes);
  return new Set(
    EXTRACTION_FIELDS.filter((f) => !any || f.schemas.some((s) => schemas[s.key]))
      .filter((f) => !OUTCOME_FIELD_IDS.includes(f.id) || needed.has(f.id))
      .map((f) => f.id),
  );
}

function hasExtractionStarted(s: Pick<ReviewState, "fieldDual" | "tagDual">) {
  const any = (m: FieldMap<unknown>) =>
    Object.values(m).some((fields) => Object.values(fields).some((r) => r?.A || r?.B || r?.resolved));
  return any(s.fieldDual) || any(s.tagDual);
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
  return PROTOTYPE_CONFIG.showOutOfScopeMocks && (designs?.[study.id] ?? study.design) === "Systematic review";
}

export function appraisalItemCount(study: CandidateStudy, designs?: Record<string, StudyDesign>) {
  return usesAmstar(study, designs) ? AMSTAR2_ITEMS.length : ROB2_DOMAINS.length;
}

/**
 * Final value of a field after human verification (null when rejected).
 * With resolvedOnly, unresolved fields return null instead of the extracted value.
 */
export function finalFieldValue(
  extracted: string,
  v: FieldVerification | undefined,
  resolvedOnly = false,
): string | null {
  if (!v || v.status === "pending") return resolvedOnly ? null : extracted;
  if (v.status === "rejected") return null;
  if (v.status === "corrected") return v.value ?? extracted;
  return extracted;
}
