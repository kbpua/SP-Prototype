// All data in this file is fictional and exists only to drive the prototype UI.
// Trial names, authors, registrations, and numbers do not refer to real studies.

export type StudyDesign =
  | "RCT"
  | "Systematic review"
  | "Observational"
  | "Economic evaluation"
  | "Protocol"
  | "Preclinical"
  | "Qualitative"
  | "Conference abstract";

export type SearchSource = "PubMed" | "Cochrane CENTRAL" | "Embase" | "HERDIN";

export type Confidence = "high" | "medium" | "low";

export const EXCLUSION_REASONS = [
  "Wrong population",
  "Wrong intervention",
  "Wrong comparator",
  "Wrong outcome",
  "Wrong study design",
  "Duplicate record",
  "Non-human study",
  "Protocol / no results",
  "Insufficient data (abstract only)",
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface TrialData {
  acronym: string;
  registration: string;
  designText: string;
  country: string;
  followUp: string;
  funding: string;
  population: string;
  lvef: string;
  meanAge: string;
  female: string;
  intervention: string;
  comparator: string;
  assessed: number;
  nT: number;
  nC: number;
  lostT: number;
  lostC: number;
  primaryOutcome: string;
  eT: number;
  eC: number;
  hr: string;
  p: string;
  saeT: number;
  saeC: number;
  metrics: { precision: number; recall: number; f1: number; kappa: number };
  /** Fields where the mock extractor is uncertain or wrong. */
  overrides: Partial<Record<FieldId, { extracted?: string; confidence: Confidence }>>;
}

export interface CandidateStudy {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  source: SearchSource;
  design: StudyDesign;
  abstract: string;
  relevance: number;
  suggested: { decision: "include" | "exclude"; reason?: ExclusionReason };
  trial?: TrialData;
}

// ---------------------------------------------------------------------------
// Extraction schema (Annex 8 / CONSORT / PRISMA mapped fields)
// ---------------------------------------------------------------------------

export type SchemaKey = "annex8" | "consort" | "prisma";

export const SCHEMA_LABELS: Record<SchemaKey, string> = {
  annex8: "Annex 8",
  consort: "CONSORT",
  prisma: "PRISMA",
};

export const SCHEMA_DESCRIPTIONS: Record<SchemaKey, string> = {
  annex8: "Philippine HTA Methods Guide — clinical evidence data extraction template",
  consort: "CONSORT 2010 checklist items for reporting randomised trials",
  prisma: "PRISMA 2020 data items and effect measures for evidence synthesis",
};

export type FieldId =
  | "registration"
  | "design"
  | "country"
  | "followUp"
  | "funding"
  | "population"
  | "lvef"
  | "meanAge"
  | "female"
  | "intervention"
  | "comparator"
  | "assessed"
  | "randomized"
  | "nT"
  | "nC"
  | "lost"
  | "primaryOutcome"
  | "eT"
  | "eC"
  | "hr"
  | "p"
  | "sae";

export type SourceLocation =
  | "Abstract"
  | "Methods §2.1"
  | "Methods §2.2"
  | "Methods §2.3"
  | "Methods §2.4"
  | "Results §3.1"
  | "Fig 1: CONSORT diagram"
  | "Table 1"
  | "Table 2"
  | "Table 3"
  | "Funding statement";

export interface FieldDef {
  id: FieldId;
  label: string;
  group: string;
  schemas: { key: SchemaKey; item: string }[];
  source: SourceLocation;
  defaultConfidence: Confidence;
  value: (t: TrialData) => string;
  /** Used by synthesis. */
  numeric?: boolean;
}

export const FIELD_GROUPS = [
  "Study characteristics",
  "Population",
  "Intervention & comparator",
  "Participant flow",
  "Outcomes",
  "Safety",
] as const;

export const EXTRACTION_FIELDS: FieldDef[] = [
  {
    id: "registration",
    label: "Trial registration",
    group: "Study characteristics",
    schemas: [
      { key: "annex8", item: "A8 · Study ID" },
      { key: "consort", item: "23" },
    ],
    source: "Abstract",
    defaultConfidence: "high",
    value: (t) => t.registration,
  },
  {
    id: "design",
    label: "Study design",
    group: "Study characteristics",
    schemas: [
      { key: "annex8", item: "A8 · Design" },
      { key: "consort", item: "3a" },
    ],
    source: "Methods §2.1",
    defaultConfidence: "high",
    value: (t) => t.designText,
  },
  {
    id: "country",
    label: "Setting / countries",
    group: "Study characteristics",
    schemas: [
      { key: "annex8", item: "A8 · Setting" },
      { key: "consort", item: "4b" },
    ],
    source: "Methods §2.1",
    defaultConfidence: "high",
    value: (t) => t.country,
  },
  {
    id: "followUp",
    label: "Median follow-up",
    group: "Study characteristics",
    schemas: [{ key: "consort", item: "14a" }],
    source: "Results §3.1",
    defaultConfidence: "medium",
    value: (t) => t.followUp,
  },
  {
    id: "funding",
    label: "Funding source",
    group: "Study characteristics",
    schemas: [
      { key: "annex8", item: "A8 · Funding" },
      { key: "consort", item: "25" },
    ],
    source: "Funding statement",
    defaultConfidence: "medium",
    value: (t) => t.funding,
  },
  {
    id: "population",
    label: "Eligible population",
    group: "Population",
    schemas: [
      { key: "annex8", item: "A8 · P" },
      { key: "consort", item: "4a" },
      { key: "prisma", item: "10b" },
    ],
    source: "Methods §2.2",
    defaultConfidence: "high",
    value: (t) => t.population,
  },
  {
    id: "lvef",
    label: "LVEF inclusion threshold",
    group: "Population",
    schemas: [{ key: "annex8", item: "A8 · P" }],
    source: "Methods §2.2",
    defaultConfidence: "high",
    value: (t) => t.lvef,
  },
  {
    id: "meanAge",
    label: "Mean age, years (SD)",
    group: "Population",
    schemas: [
      { key: "consort", item: "15" },
      { key: "prisma", item: "10b" },
    ],
    source: "Table 1",
    defaultConfidence: "high",
    value: (t) => t.meanAge,
  },
  {
    id: "female",
    label: "Female participants, %",
    group: "Population",
    schemas: [{ key: "consort", item: "15" }],
    source: "Table 1",
    defaultConfidence: "high",
    value: (t) => t.female,
  },
  {
    id: "intervention",
    label: "Intervention (dose, regimen)",
    group: "Intervention & comparator",
    schemas: [
      { key: "annex8", item: "A8 · I" },
      { key: "consort", item: "5" },
      { key: "prisma", item: "10b" },
    ],
    source: "Methods §2.3",
    defaultConfidence: "high",
    value: (t) => t.intervention,
  },
  {
    id: "comparator",
    label: "Comparator",
    group: "Intervention & comparator",
    schemas: [
      { key: "annex8", item: "A8 · C" },
      { key: "consort", item: "5" },
    ],
    source: "Methods §2.3",
    defaultConfidence: "high",
    value: (t) => t.comparator,
  },
  {
    id: "assessed",
    label: "Assessed for eligibility",
    group: "Participant flow",
    schemas: [{ key: "consort", item: "13a" }],
    source: "Fig 1: CONSORT diagram",
    defaultConfidence: "high",
    value: (t) => String(t.assessed),
    numeric: true,
  },
  {
    id: "randomized",
    label: "Randomised (total)",
    group: "Participant flow",
    schemas: [
      { key: "annex8", item: "A8 · N" },
      { key: "consort", item: "13a" },
    ],
    source: "Fig 1: CONSORT diagram",
    defaultConfidence: "high",
    value: (t) => String(t.nT + t.nC),
    numeric: true,
  },
  {
    id: "nT",
    label: "Sample size (treatment arm)",
    group: "Participant flow",
    schemas: [
      { key: "annex8", item: "A8 · n (I)" },
      { key: "consort", item: "13a" },
      { key: "prisma", item: "10a" },
    ],
    source: "Fig 1: CONSORT diagram",
    defaultConfidence: "high",
    value: (t) => String(t.nT),
    numeric: true,
  },
  {
    id: "nC",
    label: "Sample size (control arm)",
    group: "Participant flow",
    schemas: [
      { key: "annex8", item: "A8 · n (C)" },
      { key: "consort", item: "13a" },
      { key: "prisma", item: "10a" },
    ],
    source: "Fig 1: CONSORT diagram",
    defaultConfidence: "high",
    value: (t) => String(t.nC),
    numeric: true,
  },
  {
    id: "lost",
    label: "Lost to follow-up (T / C)",
    group: "Participant flow",
    schemas: [{ key: "consort", item: "13b" }],
    source: "Fig 1: CONSORT diagram",
    defaultConfidence: "high",
    value: (t) => `${t.lostT} / ${t.lostC}`,
  },
  {
    id: "primaryOutcome",
    label: "Primary outcome definition",
    group: "Outcomes",
    schemas: [
      { key: "annex8", item: "A8 · O" },
      { key: "consort", item: "6a" },
      { key: "prisma", item: "10a" },
    ],
    source: "Methods §2.4",
    defaultConfidence: "high",
    value: (t) => t.primaryOutcome,
  },
  {
    id: "eT",
    label: "Primary outcome events (treatment)",
    group: "Outcomes",
    schemas: [
      { key: "annex8", item: "A8 · Results" },
      { key: "consort", item: "17a" },
      { key: "prisma", item: "10a" },
    ],
    source: "Table 2",
    defaultConfidence: "high",
    value: (t) => String(t.eT),
    numeric: true,
  },
  {
    id: "eC",
    label: "Primary outcome events (control)",
    group: "Outcomes",
    schemas: [
      { key: "annex8", item: "A8 · Results" },
      { key: "consort", item: "17a" },
      { key: "prisma", item: "10a" },
    ],
    source: "Table 2",
    defaultConfidence: "high",
    value: (t) => String(t.eC),
    numeric: true,
  },
  {
    id: "hr",
    label: "Hazard ratio (95% CI)",
    group: "Outcomes",
    schemas: [
      { key: "annex8", item: "A8 · Effect" },
      { key: "consort", item: "17a" },
      { key: "prisma", item: "12" },
    ],
    source: "Table 2",
    defaultConfidence: "high",
    value: (t) => t.hr,
  },
  {
    id: "p",
    label: "p-value (primary outcome)",
    group: "Outcomes",
    schemas: [{ key: "consort", item: "17a" }],
    source: "Table 2",
    defaultConfidence: "high",
    value: (t) => t.p,
  },
  {
    id: "sae",
    label: "Serious adverse events (T / C)",
    group: "Safety",
    schemas: [
      { key: "annex8", item: "A8 · Harms" },
      { key: "consort", item: "19" },
    ],
    source: "Table 3",
    defaultConfidence: "high",
    value: (t) => `${t.saeT} / ${t.saeC}`,
  },
];

export interface ExtractedField {
  def: FieldDef;
  truth: string;
  extracted: string;
  confidence: Confidence;
}

export function getExtractedFields(trial: TrialData): ExtractedField[] {
  return EXTRACTION_FIELDS.map((def) => {
    const truth = def.value(trial);
    const o = trial.overrides[def.id];
    return {
      def,
      truth,
      extracted: o?.extracted ?? truth,
      confidence: o?.confidence ?? def.defaultConfidence,
    };
  });
}

// ---------------------------------------------------------------------------
// Candidate studies returned by the (mock) literature search
// ---------------------------------------------------------------------------

const hfrefPopulation =
  "Adults ≥18 years with symptomatic chronic HFrEF (NYHA class II–IV) on guideline-directed medical therapy";

export const CANDIDATE_STUDIES: CandidateStudy[] = [
  {
    id: "s01",
    title:
      "Dapagliflozin in adults with heart failure and reduced ejection fraction: the DAPA-ASIA randomised trial",
    authors: "Tan KH, Reyes MA, Nakamura Y, Wong LP, et al.",
    year: 2021,
    journal: "Journal of Asia-Pacific Cardiology",
    source: "PubMed",
    design: "RCT",
    abstract:
      "In this multinational double-blind trial, 2,363 patients with HFrEF were randomised to dapagliflozin 10 mg or placebo. Over a median of 18.2 months, the primary composite of cardiovascular death or worsening heart failure occurred in 16.6% vs 22.2% of patients…",
    relevance: 0.96,
    suggested: { decision: "include" },
    trial: {
      acronym: "DAPA-ASIA",
      registration: "NCT04120961",
      designText: "Multicentre, double-blind, placebo-controlled RCT",
      country: "Philippines, Singapore, Malaysia, Thailand, Japan (48 sites)",
      followUp: "18.2 months",
      funding: "Investigator-initiated; study drug supplied by manufacturer",
      population: hfrefPopulation,
      lvef: "LVEF ≤ 40%",
      meanAge: "64.8 (11.2)",
      female: "24.1",
      intervention: "Dapagliflozin 10 mg once daily + standard care",
      comparator: "Matching placebo + standard care",
      assessed: 3120,
      nT: 1184,
      nC: 1179,
      lostT: 12,
      lostC: 15,
      primaryOutcome:
        "Composite of cardiovascular death or worsening heart failure (hospitalisation or urgent IV therapy)",
      eT: 196,
      eC: 262,
      hr: "0.72 (0.60–0.87)",
      p: "< 0.001",
      saeT: 402,
      saeC: 455,
      metrics: { precision: 0.94, recall: 0.91, f1: 0.925, kappa: 0.88 },
      overrides: {
        lost: { extracted: "21 / 15", confidence: "low" },
        hr: { confidence: "medium" },
        funding: { confidence: "low" },
      },
    },
  },
  {
    id: "s02",
    title:
      "Effect of dapagliflozin on worsening heart failure events in a multicentre Southeast Asian population (SEA-HF)",
    authors: "Nguyen TT, Santos JL, Rahman AA, Chua MR, et al.",
    year: 2022,
    journal: "Asia-Pacific Journal of Heart Failure",
    source: "Cochrane CENTRAL",
    design: "RCT",
    abstract:
      "We randomly assigned 1,220 Southeast Asian adults with HFrEF to dapagliflozin or placebo in addition to standard therapy. Dapagliflozin reduced the risk of the primary composite outcome (HR 0.75; 95% CI 0.58–0.97)…",
    relevance: 0.94,
    suggested: { decision: "include" },
    trial: {
      acronym: "SEA-HF",
      registration: "NCT04388542",
      designText: "Multicentre, double-blind, placebo-controlled RCT",
      country: "Viet Nam, Philippines, Indonesia, Malaysia (22 sites)",
      followUp: "12.0 months",
      funding: "Regional cardiology society research grant",
      population: hfrefPopulation,
      lvef: "LVEF ≤ 40%",
      meanAge: "61.3 (12.0)",
      female: "29.7",
      intervention: "Dapagliflozin 10 mg once daily + standard care",
      comparator: "Matching placebo + standard care",
      assessed: 1544,
      nT: 612,
      nC: 608,
      lostT: 9,
      lostC: 11,
      primaryOutcome: "Composite of cardiovascular death or hospitalisation for heart failure",
      eT: 98,
      eC: 127,
      hr: "0.75 (0.58–0.97)",
      p: "0.031",
      saeT: 141,
      saeC: 163,
      metrics: { precision: 0.91, recall: 0.89, f1: 0.9, kappa: 0.84 },
      overrides: {
        eC: { extracted: "121", confidence: "low" },
        followUp: { confidence: "high" },
      },
    },
  },
  {
    id: "s03",
    title:
      "Dapagliflozin versus placebo in chronic heart failure with reduced ejection fraction: the DECIDE-HF double-blind trial",
    authors: "Müller A, Okafor C, Fernández L, Petrov I, et al.",
    year: 2020,
    journal: "International Journal of Cardiovascular Trials",
    source: "PubMed",
    design: "RCT",
    abstract:
      "A total of 4,744 patients across 20 countries were randomised. The primary outcome occurred in 386 of 2,373 patients in the dapagliflozin group and 502 of 2,371 in the placebo group (HR 0.74; 95% CI 0.65–0.85)…",
    relevance: 0.93,
    suggested: { decision: "include" },
    trial: {
      acronym: "DECIDE-HF",
      registration: "NCT03691558",
      designText: "International, double-blind, placebo-controlled RCT",
      country: "20 countries incl. Philippines (410 sites)",
      followUp: "17.6 months",
      funding: "Industry-sponsored",
      population: hfrefPopulation,
      lvef: "LVEF ≤ 40%",
      meanAge: "66.2 (10.9)",
      female: "23.4",
      intervention: "Dapagliflozin 10 mg once daily + standard care",
      comparator: "Matching placebo + standard care",
      assessed: 8134,
      nT: 2373,
      nC: 2371,
      lostT: 6,
      lostC: 8,
      primaryOutcome:
        "Composite of worsening heart failure (hospitalisation or urgent visit) or cardiovascular death",
      eT: 386,
      eC: 502,
      hr: "0.74 (0.65–0.85)",
      p: "< 0.001",
      saeT: 895,
      saeC: 950,
      metrics: { precision: 0.96, recall: 0.94, f1: 0.95, kappa: 0.91 },
      overrides: {
        nT: { extracted: "2378", confidence: "medium" },
      },
    },
  },
  {
    id: "s04",
    title:
      "Sodium–glucose cotransporter-2 inhibition and cardiovascular outcomes in HFrEF with and without diabetes (SOLACE)",
    authors: "Kim J, Park SH, Lee HY, Ito T, et al.",
    year: 2021,
    journal: "East Asian Heart Journal",
    source: "Embase",
    design: "RCT",
    abstract:
      "In 1,696 patients with HFrEF, dapagliflozin did not significantly reduce the primary composite outcome versus placebo (HR 0.96; 95% CI 0.78–1.19), with similar findings in patients with and without diabetes…",
    relevance: 0.9,
    suggested: { decision: "include" },
    trial: {
      acronym: "SOLACE",
      registration: "NCT03877224",
      designText: "Multicentre, double-blind, placebo-controlled RCT",
      country: "Republic of Korea, Japan, Taiwan (64 sites)",
      followUp: "15.3 months",
      funding: "National research foundation grant",
      population: hfrefPopulation + ", with or without type 2 diabetes",
      lvef: "LVEF ≤ 40%",
      meanAge: "63.9 (11.5)",
      female: "26.8",
      intervention: "Dapagliflozin 10 mg once daily + standard care",
      comparator: "Matching placebo + standard care",
      assessed: 2210,
      nT: 845,
      nC: 851,
      lostT: 7,
      lostC: 9,
      primaryOutcome: "Composite of cardiovascular death or hospitalisation for heart failure",
      eT: 160,
      eC: 166,
      hr: "0.96 (0.78–1.19)",
      p: "0.71",
      saeT: 288,
      saeC: 301,
      metrics: { precision: 0.9, recall: 0.88, f1: 0.89, kappa: 0.82 },
      overrides: {
        p: { extracted: "0.071", confidence: "low" },
      },
    },
  },
  {
    id: "s05",
    title:
      "Early in-hospital initiation of dapagliflozin after acute decompensated heart failure: the EARLY-DAPA randomised trial",
    authors: "Garcia R, Villanueva P, Dizon MC, Bautista JR, et al.",
    year: 2023,
    journal: "Acta Cardiologica Philippina",
    source: "HERDIN",
    design: "RCT",
    abstract:
      "Across six Philippine tertiary hospitals, 527 patients stabilised after acute decompensated HFrEF were randomised before discharge. At 6 months, the primary outcome occurred in 16.6% vs 28.2% (HR 0.57; 95% CI 0.39–0.83)…",
    relevance: 0.91,
    suggested: { decision: "include" },
    trial: {
      acronym: "EARLY-DAPA",
      registration: "PHRR230415-005112",
      designText: "Multicentre, open-label, randomised controlled trial",
      country: "Philippines (6 tertiary hospitals)",
      followUp: "6 months",
      funding: "DOH–PCHRD research grant",
      population:
        "Adults hospitalised for acute decompensated HFrEF, randomised in-hospital after haemodynamic stabilisation",
      lvef: "LVEF ≤ 40%",
      meanAge: "58.4 (13.1)",
      female: "34.2",
      intervention: "Dapagliflozin 10 mg once daily started before discharge + standard care",
      comparator: "Standard care alone",
      assessed: 811,
      nT: 265,
      nC: 262,
      lostT: 11,
      lostC: 13,
      primaryOutcome: "Composite of cardiovascular death or heart failure readmission at 6 months",
      eT: 44,
      eC: 74,
      hr: "0.57 (0.39–0.83)",
      p: "0.003",
      saeT: 61,
      saeC: 72,
      metrics: { precision: 0.88, recall: 0.86, f1: 0.87, kappa: 0.8 },
      overrides: {
        population: { confidence: "medium" },
        female: { extracted: "43.2", confidence: "low" },
        comparator: { confidence: "medium" },
      },
    },
  },
  {
    id: "s06",
    title:
      "Dapagliflozin in older adults with heart failure and reduced ejection fraction: a pragmatic randomised trial (ELDER-HF)",
    authors: "Cruz AB, Lim CS, Ong WT, Mendoza FR, et al.",
    year: 2022,
    journal: "Journal of Geriatric Cardiology Asia",
    source: "PubMed",
    design: "RCT",
    abstract:
      "We enrolled 800 patients aged ≥70 years with HFrEF. Dapagliflozin was well tolerated; the primary composite outcome occurred in 22.1% vs 25.4% of patients (HR 0.86; 95% CI 0.65–1.14)…",
    relevance: 0.88,
    suggested: { decision: "include" },
    trial: {
      acronym: "ELDER-HF",
      registration: "NCT04502381",
      designText: "Pragmatic, double-blind, placebo-controlled RCT",
      country: "Philippines, Singapore (14 sites)",
      followUp: "12.0 months",
      funding: "Academic consortium; no industry funding",
      population: "Adults ≥70 years with symptomatic chronic HFrEF (NYHA II–IV)",
      lvef: "LVEF ≤ 40%",
      meanAge: "76.9 (5.4)",
      female: "38.5",
      intervention: "Dapagliflozin 10 mg once daily + standard care",
      comparator: "Matching placebo + standard care",
      assessed: 1102,
      nT: 402,
      nC: 398,
      lostT: 10,
      lostC: 12,
      primaryOutcome: "Composite of cardiovascular death or hospitalisation for heart failure",
      eT: 89,
      eC: 101,
      hr: "0.86 (0.65–1.14)",
      p: "0.29",
      saeT: 132,
      saeC: 139,
      metrics: { precision: 0.92, recall: 0.9, f1: 0.91, kappa: 0.86 },
      overrides: {
        meanAge: { confidence: "medium" },
        sae: { extracted: "132 / 193", confidence: "low" },
      },
    },
  },
  {
    id: "s07",
    title:
      "Dapagliflozin in heart failure with mildly reduced or preserved ejection fraction: the PRESERVE-D trial",
    authors: "Haddad S, Lindqvist E, Oyelaran B, et al.",
    year: 2022,
    journal: "European Journal of Heart Failure Research",
    source: "PubMed",
    design: "RCT",
    abstract:
      "Patients with LVEF > 40% were randomised to dapagliflozin or placebo. The primary composite outcome was reduced (HR 0.82)… Results support SGLT2 inhibition across the ejection-fraction spectrum.",
    relevance: 0.81,
    suggested: { decision: "exclude", reason: "Wrong population" },
  },
  {
    id: "s08",
    title:
      "Head-to-head comparison of dapagliflozin and empagliflozin in HFrEF: a randomised pragmatic trial",
    authors: "Aquino LM, Santiago RT, Yap KC, et al.",
    year: 2024,
    journal: "Clinical Cardiology Pragmatics",
    source: "Embase",
    design: "RCT",
    abstract:
      "This pragmatic trial compared two SGLT2 inhibitors in 640 HFrEF patients. No significant difference was observed in heart failure hospitalisation between agents…",
    relevance: 0.78,
    suggested: { decision: "exclude", reason: "Wrong comparator" },
  },
  {
    id: "s09",
    title:
      "SGLT2 inhibitors in heart failure: a systematic review and meta-analysis of randomised controlled trials",
    authors: "Del Rosario JP, Chen W, Abubakar S, et al.",
    year: 2023,
    journal: "Systematic Reviews in Cardiology",
    source: "Cochrane CENTRAL",
    design: "Systematic review",
    abstract:
      "We pooled 13 RCTs (n = 29,450). SGLT2 inhibitors reduced cardiovascular death or HF hospitalisation (RR 0.77; 95% CI 0.72–0.82) with low heterogeneity… Used for reference-list checking.",
    relevance: 0.74,
    suggested: { decision: "exclude", reason: "Wrong study design" },
  },
  {
    id: "s10",
    title:
      "Real-world utilisation and outcomes of dapagliflozin at a Philippine tertiary heart centre: a retrospective cohort",
    authors: "Manalo EG, Francisco AR, De Leon PJ, et al.",
    year: 2024,
    journal: "Philippine Journal of Cardiovascular Medicine",
    source: "HERDIN",
    design: "Observational",
    abstract:
      "Records of 1,012 patients with HFrEF were reviewed. Dapagliflozin users had lower 12-month readmission rates after propensity matching…",
    relevance: 0.69,
    suggested: { decision: "exclude", reason: "Wrong study design" },
  },
  {
    id: "s11",
    title:
      "Cost-effectiveness of dapagliflozin for HFrEF in the Philippine setting: a Markov model analysis",
    authors: "Lopez MB, Tolentino KA, Haw NJ, et al.",
    year: 2024,
    journal: "Value in Health Regional Issues (Asia)",
    source: "HERDIN",
    design: "Economic evaluation",
    abstract:
      "Using a lifetime Markov model from the PhilHealth payer perspective, dapagliflozin yielded an ICER of PHP 312,000 per QALY gained… Referred to the economic evaluation workstream.",
    relevance: 0.66,
    suggested: { decision: "exclude", reason: "Wrong outcome" },
  },
  {
    id: "s12",
    title: "Dapagliflozin and health-related quality of life in HFrEF: interim results",
    authors: "Rivera JC, Soriano MA, et al.",
    year: 2023,
    journal: "Heart Failure Congress Abstracts",
    source: "Embase",
    design: "Conference abstract",
    abstract:
      "Interim analysis of 214 patients showed improvement in KCCQ scores at 12 weeks. Full results pending peer review…",
    relevance: 0.63,
    suggested: { decision: "exclude", reason: "Insufficient data (abstract only)" },
  },
  {
    id: "s13",
    title:
      "Cardioprotective mechanisms of SGLT2 inhibition in a murine model of pressure-overload heart failure",
    authors: "Zhang L, Watanabe K, Morales D, et al.",
    year: 2021,
    journal: "Journal of Experimental Cardiology",
    source: "PubMed",
    design: "Preclinical",
    abstract:
      "In transverse aortic constriction mice, dapagliflozin attenuated fibrosis and preserved systolic function via reduced myocardial sodium–hydrogen exchange…",
    relevance: 0.41,
    suggested: { decision: "exclude", reason: "Non-human study" },
  },
  {
    id: "s14",
    title: "Glycaemic efficacy of dapagliflozin add-on therapy in Filipino adults with type 2 diabetes",
    authors: "Panganiban RS, Uy JL, Alvarez MT, et al.",
    year: 2020,
    journal: "Journal of the ASEAN Federation of Endocrine Societies",
    source: "HERDIN",
    design: "RCT",
    abstract:
      "A 24-week trial in 320 adults with inadequately controlled T2DM showed a placebo-adjusted HbA1c reduction of 0.6%… Patients with heart failure were excluded.",
    relevance: 0.52,
    suggested: { decision: "exclude", reason: "Wrong population" },
  },
  {
    id: "s15",
    title: "Rationale and design of the DAPA-PH pragmatic trial in heart failure",
    authors: "Salazar VR, Domingo AG, et al.",
    year: 2025,
    journal: "Trials in Asia",
    source: "PubMed",
    design: "Protocol",
    abstract:
      "This protocol describes a planned pragmatic trial of 1,500 Filipino patients with HFrEF across 12 regions. Recruitment is ongoing; no outcome data are reported…",
    relevance: 0.58,
    suggested: { decision: "exclude", reason: "Protocol / no results" },
  },
  {
    id: "s16",
    title: "Sacubitril–valsartan versus enalapril in Asian patients with HFrEF",
    authors: "Sato H, Kumar R, Lim J, et al.",
    year: 2021,
    journal: "Asian Heart Outcomes",
    source: "Cochrane CENTRAL",
    design: "RCT",
    abstract:
      "Among 2,100 Asian patients with HFrEF, sacubitril–valsartan reduced CV death or HF hospitalisation compared with enalapril (HR 0.81)…",
    relevance: 0.55,
    suggested: { decision: "exclude", reason: "Wrong intervention" },
  },
  {
    id: "s17",
    title: "Dapagliflozin in patients with chronic kidney disease with and without heart failure",
    authors: "Andersson P, Mbeki T, Guerrero F, et al.",
    year: 2021,
    journal: "Nephrology Clinical Trials",
    source: "PubMed",
    design: "RCT",
    abstract:
      "In 4,304 patients with CKD, dapagliflozin reduced the composite kidney outcome. A minority (11%) had heart failure at baseline; HF subgroup data are limited…",
    relevance: 0.61,
    suggested: { decision: "exclude", reason: "Wrong population" },
  },
  {
    id: "s18",
    title: "Empagliflozin in chronic heart failure with reduced ejection fraction: a randomised trial",
    authors: "Weber F, Costa M, Hassan R, et al.",
    year: 2020,
    journal: "International Journal of Cardiovascular Trials",
    source: "PubMed",
    design: "RCT",
    abstract:
      "In 3,730 patients with HFrEF, empagliflozin reduced the composite of CV death or HF hospitalisation (HR 0.75) compared with placebo…",
    relevance: 0.72,
    suggested: { decision: "exclude", reason: "Wrong intervention" },
  },
  {
    id: "s19",
    title:
      "Dapagliflozin in adults with heart failure and reduced ejection fraction: the DAPA-ASIA randomised trial",
    authors: "Tan KH, Reyes MA, Nakamura Y, Wong LP, et al.",
    year: 2021,
    journal: "Journal of Asia-Pacific Cardiology",
    source: "Embase",
    design: "RCT",
    abstract:
      "Duplicate of PubMed record (same DOI). In this multinational double-blind trial, 2,363 patients with HFrEF were randomised…",
    relevance: 0.95,
    suggested: { decision: "exclude", reason: "Duplicate record" },
  },
  {
    id: "s20",
    title:
      "Patient perspectives on SGLT2 inhibitor adherence in Filipino heart failure clinics: a qualitative study",
    authors: "Bernardo CL, Ramos GF, et al.",
    year: 2024,
    journal: "Philippine Journal of Nursing Research",
    source: "HERDIN",
    design: "Qualitative",
    abstract:
      "Semi-structured interviews with 28 patients identified cost, pill burden, and genital infections as barriers to adherence…",
    relevance: 0.38,
    suggested: { decision: "exclude", reason: "Wrong study design" },
  },
];

/** Screening recommendation bands derived from the relevance score. */
export const RECOMMENDATION_THRESHOLDS = { include: 0.85, review: 0.6 };

/** Pre-scripted "AI-generated" screening rationales, written to match each study's score band. */
export const SCREENING_RATIONALES: Record<string, string> = {
  s01: "Randomised, placebo-controlled trial in adults with HFrEF (LVEF ≤ 40%) comparing dapagliflozin 10 mg with placebo on top of standard care, reporting CV death or worsening HF — matches all PICOS elements.",
  s19: "Matches all PICOS elements: an RCT of dapagliflozin vs placebo in adults with HFrEF reporting the composite CV outcome. Title and authors are identical to a PubMed record, so check for duplication before confirming.",
  s02: "RCT in Southeast Asian adults with HFrEF comparing dapagliflozin with placebo plus standard therapy and reporting CV death or HF hospitalisation — a close PICOS match with high regional relevance.",
  s03: "Large double-blind RCT of dapagliflozin vs placebo in chronic HFrEF with event counts for the primary composite outcome; population, intervention, comparator, outcome and design all align.",
  s05: "Philippine multicentre RCT of dapagliflozin vs standard care in HFrEF after acute decompensation, reporting CV death or HF readmission. Open-label design noted, but all PICOS criteria are met.",
  s04: "RCT of dapagliflozin vs placebo in HFrEF with and without diabetes, reporting CV death or HF hospitalisation — matches population, intervention, comparator and outcome.",
  s06: "RCT of dapagliflozin vs placebo in adults ≥ 70 years with HFrEF reporting the composite CV outcome; an older cohort, but within the eligible population.",
  s07: "Intervention, comparator and outcome match, but the population has LVEF > 40% (HFmrEF/HFpEF), outside the HFrEF criterion. Check whether an HFrEF subgroup is reported.",
  s08: "Population and intervention match, but the comparator is another SGLT2 inhibitor (empagliflozin) rather than placebo or standard care; head-to-head designs are listed under exclusion criteria.",
  s09: "Topic matches the review question, but this is a systematic review and meta-analysis rather than a primary RCT. Useful for reference checking; confirm against the study-design criterion.",
  s18: "RCT design, HFrEF population and outcome match, but the intervention is empagliflozin, not dapagliflozin. Relevant only if the question is widened to the SGLT2-inhibitor class.",
  s10: "Relevant Philippine population and intervention, but a retrospective observational cohort does not meet the RCT study-design criterion.",
  s11: "Addresses dapagliflozin in Philippine HFrEF patients, but reports cost-effectiveness (ICER per QALY) rather than clinical outcomes; better suited to the economic evaluation workstream.",
  s12: "Relevant population and intervention, but a conference abstract with interim quality-of-life data only, giving insufficient outcome data for extraction.",
  s17: "Dapagliflozin RCT, but the population is chronic kidney disease with only a minority having heart failure; HFrEF-specific outcome data appear limited.",
  s15: "Trial protocol with no results reported; does not meet the outcome requirement for reported CV death or HF events.",
  s16: "HFrEF RCT, but it evaluates sacubitril–valsartan vs enalapril; neither the intervention nor the comparator matches the PICOS question.",
  s14: "Dapagliflozin RCT in adults with type 2 diabetes that excluded heart failure and reports glycaemic outcomes; population and outcome do not match.",
  s13: "Preclinical murine study; the non-human population and mechanistic outcomes fall outside the PICOS criteria.",
  s20: "Qualitative interview study on adherence with no randomised comparison and no CV death or HF event outcomes; study design and outcomes do not match.",
};

export const SEARCH_SUMMARY = {
  databases: [
    { name: "PubMed", records: 8 },
    { name: "Cochrane CENTRAL", records: 4 },
    { name: "Embase", records: 4 },
    { name: "HERDIN", records: 4 },
  ],
  query:
    '("dapagliflozin" OR "SGLT2 inhibitor") AND ("heart failure" OR "HFrEF") AND (randomized OR trial)',
  searchedOn: "Sep 21, 2026",
};

// ---------------------------------------------------------------------------
// Critical appraisal instruments
// ---------------------------------------------------------------------------

export const ROB2_DOMAINS = [
  {
    id: "d1",
    title: "D1 · Randomisation process",
    hint: "Was the allocation sequence random and concealed? Were baseline differences suggestive of a problem?",
  },
  {
    id: "d2",
    title: "D2 · Deviations from intended interventions",
    hint: "Were participants and personnel aware of assignment? Were there deviations that arose because of the trial context?",
  },
  {
    id: "d3",
    title: "D3 · Missing outcome data",
    hint: "Were outcome data available for all, or nearly all, randomised participants?",
  },
  {
    id: "d4",
    title: "D4 · Measurement of the outcome",
    hint: "Was the method of measuring the outcome inappropriate, or could assessment have been influenced by knowledge of the intervention?",
  },
  {
    id: "d5",
    title: "D5 · Selection of the reported result",
    hint: "Was the result selected from multiple eligible outcome measurements or analyses?",
  },
] as const;

export const AMSTAR2_ITEMS = [
  { id: "a1", title: "PICO components in research questions and inclusion criteria", critical: false },
  { id: "a2", title: "Protocol registered before commencement of the review", critical: true },
  { id: "a3", title: "Explanation of study designs selected for inclusion", critical: false },
  { id: "a4", title: "Comprehensive literature search strategy", critical: true },
  { id: "a5", title: "Study selection performed in duplicate", critical: false },
  { id: "a6", title: "Data extraction performed in duplicate", critical: false },
  { id: "a7", title: "List of excluded studies with justification", critical: true },
  { id: "a8", title: "Included studies described in adequate detail", critical: false },
  { id: "a9", title: "Satisfactory technique for assessing risk of bias", critical: true },
  { id: "a10", title: "Sources of funding for included studies reported", critical: false },
  { id: "a11", title: "Appropriate methods for statistical combination", critical: true },
  { id: "a12", title: "Impact of RoB on meta-analysis results assessed", critical: false },
  { id: "a13", title: "RoB accounted for when interpreting results", critical: true },
  { id: "a14", title: "Satisfactory explanation of heterogeneity", critical: false },
  { id: "a15", title: "Publication bias investigated", critical: true },
  { id: "a16", title: "Conflicts of interest reported", critical: false },
] as const;

/** Sample judgements used only by the "load sample appraisal" demo shortcut. */
export const SAMPLE_ROB2: Record<string, Record<string, { j: "low" | "some" | "high"; note: string }>> = {
  s01: {
    d1: { j: "low", note: "Central web-based randomisation with concealed allocation." },
    d2: { j: "low", note: "Double-blind; matching placebo." },
    d3: { j: "low", note: "Outcome data available for >98% of participants." },
    d4: { j: "low", note: "Blinded clinical events committee adjudicated outcomes." },
    d5: { j: "low", note: "Pre-registered primary outcome reported as planned." },
  },
  s02: {
    d1: { j: "low", note: "Computer-generated sequence; sealed envelopes held centrally." },
    d2: { j: "low", note: "Double-blind design maintained throughout." },
    d3: { j: "low", note: "Loss to follow-up < 2% in both arms." },
    d4: { j: "some", note: "Adjudication committee composition not fully described." },
    d5: { j: "low", note: "Consistent with registry entry." },
  },
  s03: {
    d1: { j: "low", note: "Interactive voice-response randomisation, stratified by diabetes status." },
    d2: { j: "low", note: "Double-blind; adherence > 90%." },
    d3: { j: "low", note: "Vital status known for 99.7% of participants." },
    d4: { j: "low", note: "Blinded adjudication of all endpoints." },
    d5: { j: "low", note: "SAP published before unblinding." },
  },
  s04: {
    d1: { j: "some", note: "Allocation concealment method not reported." },
    d2: { j: "low", note: "Double-blind." },
    d3: { j: "low", note: "Minimal missing data." },
    d4: { j: "low", note: "Blinded outcome assessment." },
    d5: { j: "some", note: "Secondary endpoints changed after registration." },
  },
  s05: {
    d1: { j: "low", note: "Block randomisation via central pharmacy." },
    d2: { j: "high", note: "Open-label design; co-interventions differed between arms." },
    d3: { j: "some", note: "~4.6% lost to follow-up; reasons partly reported." },
    d4: { j: "some", note: "Readmission ascertained by unblinded site staff." },
    d5: { j: "low", note: "Primary outcome matches PHRR registration." },
  },
  s06: {
    d1: { j: "low", note: "Central randomisation, stratified by site." },
    d2: { j: "low", note: "Double-blind; pragmatic follow-up." },
    d3: { j: "some", note: "Higher dropout in older participants; sensitivity analysis provided." },
    d4: { j: "low", note: "Hospital records adjudicated blindly." },
    d5: { j: "low", note: "Pre-specified analysis." },
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const ACTIVE_REVIEW_ID = "rv-2026-014";

export const DEFAULT_REVIEW_CONFIG = {
  title: "Dapagliflozin versus standard care for adults with heart failure with reduced ejection fraction",
  population: "Adults (≥18 years) with symptomatic chronic heart failure with reduced ejection fraction (LVEF ≤ 40%)",
  intervention: "Dapagliflozin 10 mg once daily added to standard care",
  comparator: "Placebo or standard care alone",
  outcome: "Composite of cardiovascular death or worsening heart failure; serious adverse events",
  studyDesign: "Randomised controlled trials",
  inclusion: [
    "Randomised controlled trial",
    "Adults with HFrEF (LVEF ≤ 40%)",
    "Dapagliflozin vs placebo / standard care",
    "Reports CV death or HF events",
    "English language",
  ],
  exclusion: [
    "HFpEF / HFmrEF populations",
    "Head-to-head SGLT2 inhibitor comparisons",
    "Conference abstracts without full data",
    "Non-human studies",
  ],
};

export const OTHER_REVIEWS = [
  {
    id: "rv-2026-011",
    title: "PCV13 versus PCV10 for prevention of invasive pneumococcal disease in children under five",
    stage: "Screening",
    percent: 34,
    updated: "2 days ago",
    lead: "J. Villareal",
    studies: 412,
  },
  {
    id: "rv-2026-009",
    title: "Bedaquiline-containing regimens for multidrug-resistant tuberculosis",
    stage: "Appraisal",
    percent: 52,
    updated: "5 days ago",
    lead: "M. Ocampo",
    studies: 38,
  },
  {
    id: "rv-2026-006",
    title: "Semaglutide for glycaemic control in adults with type 2 diabetes",
    stage: "Completed",
    percent: 100,
    updated: "Sep 12, 2026",
    lead: "R. Aguilar",
    studies: 24,
  },
];

export const DASHBOARD_STATS = {
  screened: 1284,
  extracted: 312,
  fieldsVerified: 6847,
  completed: 7,
};

export const THROUGHPUT = [
  { week: "Aug 3", extracted: 18, verified: 14 },
  { week: "Aug 10", extracted: 24, verified: 20 },
  { week: "Aug 17", extracted: 21, verified: 21 },
  { week: "Aug 24", extracted: 33, verified: 27 },
  { week: "Aug 31", extracted: 29, verified: 28 },
  { week: "Sep 7", extracted: 41, verified: 35 },
  { week: "Sep 14", extracted: 38, verified: 37 },
  { week: "Sep 21", extracted: 46, verified: 41 },
];

export const ANALYST = { name: "HTA Analyst", role: "HTAC Secretariat", initials: "HA" };
