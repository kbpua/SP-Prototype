// UNVERIFIED: check category names and themes against the source document before the defense.
// Placeholder seed from the 2022 Philippine Social Values guidelines; editable configuration only.

import type { FieldId } from "@/data/mockData";

export type StakeholderCategoryId =
  | "subpopulations"
  | "goals"
  | "patient-centeredness"
  | "generalized-others"
  | "just-allocation"
  | "quality-system";

export interface TagRule {
  /** Extraction fields the rule is checked against. */
  fields: FieldId[];
  /** Case-insensitive keywords or labels; any match produces the tag. */
  keywords: string[];
  theme: string;
}

export interface StakeholderCategory {
  id: StakeholderCategoryId;
  name: string;
  themes: string[];
  mappable: "Yes" | "Rarely";
  mappableNote?: string;
  rules: TagRule[];
}

export const STAKEHOLDER_CATEGORIES: StakeholderCategory[] = [
  {
    id: "subpopulations",
    name: "Subpopulations needing special consideration",
    themes: ["children", "older adults", "resource-poor settings", "Indigenous peoples"],
    mappable: "Yes",
    mappableNote: "population fields",
    rules: [
      { fields: ["population", "meanAge"], keywords: ["older adults", "elderly", "≥75", "≥ 75", "aged 75"], theme: "older adults" },
      { fields: ["population"], keywords: ["children", "paediatric", "pediatric", "adolescent"], theme: "children" },
      { fields: ["population", "country"], keywords: ["indigenous"], theme: "Indigenous peoples" },
      { fields: ["population", "country"], keywords: ["resource-poor", "low-resource", "rural"], theme: "resource-poor settings" },
    ],
  },
  {
    id: "goals",
    name: "Goals of interventions",
    themes: ["quality of life", "prolongs life"],
    mappable: "Yes",
    mappableNote: "QoL, survival, mortality",
    rules: [
      { fields: ["primaryOutcome"], keywords: ["death", "mortality", "survival"], theme: "prolongs life" },
      { fields: ["primaryOutcome"], keywords: ["quality of life", "kccq", "health status"], theme: "quality of life" },
    ],
  },
  {
    id: "patient-centeredness",
    name: "Patient-centeredness",
    themes: ["autonomy", "dignity", "privacy"],
    mappable: "Rarely",
    rules: [{ fields: ["primaryOutcome", "population"], keywords: ["autonomy", "dignity", "privacy"], theme: "autonomy" }],
  },
  {
    id: "generalized-others",
    name: "Generalized Others",
    themes: ["family", "community values"],
    mappable: "Rarely",
    rules: [{ fields: ["primaryOutcome", "population"], keywords: ["caregiver", "family", "community"], theme: "family" }],
  },
  {
    id: "just-allocation",
    name: "Just allocation",
    themes: ["equity", "utilitarianism"],
    mappable: "Rarely",
    rules: [{ fields: ["population", "funding"], keywords: ["equity", "low-income"], theme: "equity" }],
  },
  {
    id: "quality-system",
    name: "Quality healthcare system",
    themes: ["comprehensive care", "trustworthiness"],
    mappable: "Rarely",
    rules: [{ fields: ["intervention"], keywords: ["comprehensive care", "integrated care"], theme: "comprehensive care" }],
  },
];

export const DEFAULT_STAKEHOLDER_CATEGORIES: StakeholderCategoryId[] = ["subpopulations", "goals"];

export interface SuggestedTag {
  fieldId: FieldId;
  categoryId: StakeholderCategoryId;
  label: string;
}

/** Rule-based tag for one field value: first matching rule among the selected categories. */
export function suggestTag(fieldId: FieldId, value: string, selected: StakeholderCategoryId[]): SuggestedTag | null {
  const text = value.toLowerCase();
  for (const cat of STAKEHOLDER_CATEGORIES) {
    if (!selected.includes(cat.id)) continue;
    for (const rule of cat.rules) {
      if (!rule.fields.includes(fieldId)) continue;
      if (rule.keywords.some((k) => text.includes(k.toLowerCase()))) {
        return { fieldId, categoryId: cat.id, label: `${cat.name}: ${rule.theme}` };
      }
    }
  }
  return null;
}
