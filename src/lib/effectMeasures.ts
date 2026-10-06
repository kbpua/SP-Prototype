import type { FieldId } from "@/data/mockData";
import type { EffectMeasure } from "./meta";

export type OutcomeType = "time-to-event" | "dichotomous" | "continuous";

export interface OutcomeMeasure {
  outcomeId: string;
  outcomeName: string;
  type: OutcomeType;
  measure: EffectMeasure;
  isPrimary: boolean;
  /** "suggested" while the measure is the type's default lookup; "analyst" once picked by hand. */
  measureSource?: "suggested" | "analyst";
}

export interface EffectMeasureChange {
  outcomeId: string;
  outcomeName: string;
  setting: "outcome type" | "effect measure";
  previous: string;
  next: string;
  role: string;
  at: string;
  note: "changed after extraction started";
}

export const OUTCOME_TYPES: { value: OutcomeType; label: string }[] = [
  { value: "time-to-event", label: "Time-to-event" },
  { value: "dichotomous", label: "Dichotomous" },
  { value: "continuous", label: "Continuous" },
];

export const OUTCOME_TYPE_LABELS: Record<OutcomeType, string> = {
  "time-to-event": "Time-to-event",
  dichotomous: "Dichotomous",
  continuous: "Continuous",
};

export const MEASURE_NAMES: Record<EffectMeasure, string> = {
  RR: "Risk ratio",
  OR: "Odds ratio",
  HR: "Hazard ratio",
  MD: "Mean difference",
};

/** Measures valid for each outcome type; the first entry is the default. */
export const VALID_MEASURES: Record<OutcomeType, EffectMeasure[]> = {
  "time-to-event": ["HR"],
  dichotomous: ["RR", "OR"],
  continuous: ["MD"],
};

export const defaultMeasureFor = (type: OutcomeType) => VALID_MEASURES[type][0];
export const isValidMeasure = (type: OutcomeType, m: EffectMeasure) => VALID_MEASURES[type].includes(m);

/** How each measure is estimated from extracted values. */
export const MEASURE_METHOD: Record<EffectMeasure, string> = {
  HR: "log HR and SE from the reported HR (95% CI)",
  RR: "log RR from events and totals per arm",
  OR: "log OR from events and totals per arm",
  MD: "MD from means, SDs and n per arm",
};

/**
 * Mock-data source for an outcome. "trialPrimary" reads the trial's primary-outcome fields,
 * "sae" the serious-adverse-event counts. Outcomes without mock data are configured but not extracted.
 */
export type OutcomeDataKey = "trialPrimary" | "sae";

const SEED_IDS: Record<string, { id: string; dataKey: OutcomeDataKey }> = {
  "composite of cardiovascular death or worsening heart failure": { id: "composite", dataKey: "trialPrimary" },
  "serious adverse events": { id: "sae", dataKey: "sae" },
};

const DATA_KEY_BY_ID: Record<string, OutcomeDataKey> = { composite: "trialPrimary", sae: "sae" };

export const outcomeDataKey = (o: Pick<OutcomeMeasure, "outcomeId">): OutcomeDataKey | null =>
  DATA_KEY_BY_ID[o.outcomeId] ?? null;

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const slug = (s: string) =>
  normName(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "outcome";

/** Splits the review question's Outcomes field into outcome rows (semicolon- or line-separated). */
export function parseOutcomes(text: string): { outcomeId: string; outcomeName: string }[] {
  const seen = new Set<string>();
  const out: { outcomeId: string; outcomeName: string }[] = [];
  for (const raw of text.split(/[;\n]/)) {
    const name = raw.trim().replace(/\.$/, "");
    if (!name) continue;
    const id = SEED_IDS[normName(name)]?.id ?? slug(name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ outcomeId: id, outcomeName: name.charAt(0).toUpperCase() + name.slice(1) });
  }
  return out;
}

export const SEED_EFFECT_MEASURES: OutcomeMeasure[] = [
  {
    outcomeId: "composite",
    outcomeName: "Composite of cardiovascular death or worsening heart failure",
    type: "time-to-event",
    measure: "HR",
    isPrimary: true,
    measureSource: "suggested",
  },
  {
    outcomeId: "sae",
    outcomeName: "Serious adverse events",
    type: "dichotomous",
    measure: "RR",
    isPrimary: false,
    measureSource: "suggested",
  },
];

/**
 * Rows for the outcomes currently listed in the Outcomes field, carrying over saved settings.
 * New outcomes start as Dichotomous until the analyst sets the type. Exactly one row is primary.
 */
export function reconcileOutcomes(outcomeText: string, saved: OutcomeMeasure[]): OutcomeMeasure[] {
  const rows = parseOutcomes(outcomeText).map((p) => {
    const prev = saved.find((s) => s.outcomeId === p.outcomeId);
    return prev
      ? { ...prev, outcomeName: p.outcomeName }
      : {
          ...p,
          type: "dichotomous" as OutcomeType,
          measure: defaultMeasureFor("dichotomous"),
          isPrimary: false,
          measureSource: "suggested" as const,
        };
  });
  const primaryIdx = rows.findIndex((r) => r.isPrimary);
  return rows.map((r, i) => ({ ...r, isPrimary: primaryIdx === -1 ? i === 0 : i === primaryIdx }));
}

/** Extraction fields that depend on an outcome's measure. */
export const OUTCOME_FIELD_IDS: FieldId[] = ["eT", "eC", "hr", "mdT", "mdC", "sae"];

/** Outcome-dependent fields required by the configured measures. */
export function outcomeFieldIds(outcomes: OutcomeMeasure[]): Set<FieldId> {
  const ids = new Set<FieldId>();
  for (const o of outcomes) {
    const key = outcomeDataKey(o);
    if (key === "sae") ids.add("sae");
    if (key !== "trialPrimary") continue;
    if (o.measure === "HR") ids.add("hr");
    if (o.measure === "RR" || o.measure === "OR") (ids.add("eT"), ids.add("eC"));
    if (o.measure === "MD") (ids.add("mdT"), ids.add("mdC"));
  }
  return ids;
}
