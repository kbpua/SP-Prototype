import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Lock, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader, StageFooter } from "@/components/PageHeader";
import { CodeMenu, GUIDE_REFS, GuideRef } from "@/components/guide";
import { useReview, type ReviewConfig } from "@/state/ReviewContext";
import { SCHEMA_DESCRIPTIONS, SCHEMA_LABELS, type IneligibilityCode, type SchemaKey } from "@/data/mockData";
import type { EffectMeasure } from "@/lib/meta";
import { MEASURE_NAMES, OUTCOME_TYPES, isValidMeasure, type OutcomeType } from "@/lib/effectMeasures";
import { STAKEHOLDER_CATEGORIES } from "@/config/stakeholderCategories";
import { cn } from "@/lib/utils";

const PICO: { key: keyof ReviewConfig; letter: string; label: string; placeholder: string; helper?: string }[] = [
  { key: "population", letter: "P", label: "Population", placeholder: "Who are the patients?" },
  { key: "intervention", letter: "I", label: "Intervention", placeholder: "Health technology being assessed" },
  { key: "comparator", letter: "C", label: "Comparator", placeholder: "Current standard of care, placebo…" },
  {
    key: "outcome",
    letter: "O",
    label: "Outcomes",
    placeholder: "Critical and important outcomes",
    helper: "Separate outcomes with semicolons; each gets its own effect measure.",
  },
  {
    key: "studyDesign",
    letter: "S",
    label: "Study design",
    placeholder: "e.g. Randomised controlled trials",
    helper: "Eligible: randomised controlled trials.",
  },
];

/** Criteria the Guide asks to justify: language restrictions and excluding grey literature. */
const needsJustification = (item: string) => /language|conference abstract/i.test(item);

const MEASURE_CARDS: EffectMeasure[] = ["RR", "OR", "HR", "MD"];

const POST_HOC_CONFIRM =
  "Changing the effect measure after extraction has started will be logged in the audit trail. Continue?";

function EffectMeasureCard() {
  const { effectMeasures, extractionStarted, setOutcomeMeasure } = useReview();
  const change = (outcomeId: string, patch: { type?: OutcomeType; measure?: EffectMeasure }) => {
    if (extractionStarted && !window.confirm(POST_HOC_CONFIRM)) return;
    setOutcomeMeasure(outcomeId, patch);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target effect measure</CardTitle>
        <CardDescription>Pre-specified per outcome. Changes after extraction are logged in the audit trail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {effectMeasures.length === 0 && (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-ink-muted">
            List outcomes in the review question (separated by semicolons) to set their effect measures.
          </p>
        )}
        {effectMeasures.map((o) => (
          <div
            key={o.outcomeId}
            className={cn("rounded-lg border p-3", o.isPrimary ? "border-brand-300 bg-brand-50/40" : "border-line")}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="radio"
                name="primary-outcome"
                aria-label={`Primary outcome: ${o.outcomeName}`}
                checked={o.isPrimary}
                onChange={() => setOutcomeMeasure(o.outcomeId, { isPrimary: true })}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#0f6e56]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-medium leading-snug text-ink">{o.outcomeName}</span>
                  {o.isPrimary && <Badge variant="solid">Primary</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Label htmlFor={`type-${o.outcomeId}`} className="text-[12px] text-ink-muted">
                    Outcome type
                  </Label>
                  <select
                    id={`type-${o.outcomeId}`}
                    value={o.type}
                    onChange={(e) => change(o.outcomeId, { type: e.target.value as OutcomeType })}
                    className="h-8 cursor-pointer rounded-md border border-line bg-white px-2 text-[12.5px] text-ink focus:border-brand-400 focus:outline-none"
                  >
                    {OUTCOME_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Effect measure: ${o.outcomeName}`}>
                  {MEASURE_CARDS.map((m) => {
                    const valid = isValidMeasure(o.type, m);
                    const on = o.measure === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-disabled={!valid}
                        title={valid ? MEASURE_NAMES[m] : "Not valid for this outcome type"}
                        onClick={() => valid && !on && change(o.outcomeId, { measure: m })}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-left transition-all",
                          !valid && "cursor-not-allowed opacity-40",
                          valid && !on && "cursor-pointer border-line bg-white hover:bg-cream",
                          on && "border-brand-500 bg-brand-50 ring-2 ring-brand-500/15",
                        )}
                      >
                        <div className={cn("text-[14px] font-semibold", on ? "text-brand-700" : "text-ink")}>{m}</div>
                        <div className="text-[10.5px] leading-tight text-ink-muted">{MEASURE_NAMES[m]}</div>
                      </button>
                    );
                  })}
                </div>
                {o.measureSource !== "analyst" && (
                  <div className="mt-1.5 text-[11px] text-ink-muted">Suggested from outcome type</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {effectMeasures.some((o) => o.type === "time-to-event") && (
          <p className="text-[11.5px] leading-snug text-ink-muted">
            Time-to-event outcomes are pooled from the log hazard ratio; a crude risk ratio is never pooled for them.
          </p>
        )}
        <GuideRef>Guide p. 15 · Relative effect size with confidence interval</GuideRef>
      </CardContent>
    </Card>
  );
}

export default function Configuration() {
  const navigate = useNavigate();
  const { config, updateConfig } = useReview();

  return (
    <PageContainer>
      <PageHeader
        step="Stage 1 of 6"
        title="Review configuration"
        description="Define the review question (PICO plus study design), set eligibility criteria, and choose which guideline-aligned field sets the extraction module should populate."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 min-w-0">
        <div className="col-span-1 lg:col-span-3 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Review question</CardTitle>
              <CardDescription>
                Structured as PICO for inclusion criteria (Annex 6, p. 73); the policy question uses PICOT (p. 14).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Review title</Label>
                <Input id="title" value={config.title} onChange={(e) => updateConfig({ title: e.target.value })} />
              </div>
              {PICO.map((p) => (
                <div key={p.key} className="flex gap-3">
                  <div className="mt-6 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-[13px] font-semibold text-brand-700">
                    {p.letter}
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Label htmlFor={p.key}>{p.label}</Label>
                    <Textarea
                      id={p.key}
                      rows={2}
                      className="min-h-[56px]"
                      placeholder={p.placeholder}
                      value={config[p.key] as string}
                      onChange={(e) => updateConfig({ [p.key]: e.target.value } as Partial<ReviewConfig>)}
                    />
                    {p.helper && <p className="text-[11.5px] text-ink-muted">{p.helper}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility criteria</CardTitle>
              <CardDescription>
                Criteria are embedded alongside the PICO question to rank candidate studies during screening.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <CriteriaBuilder
                  label="Inclusion"
                  tone="include"
                  items={config.inclusion}
                  onChange={(inclusion) => updateConfig({ inclusion })}
                  justifications={config.justifications}
                  onJustify={(item, text) => updateConfig({ justifications: { ...config.justifications, [item]: text } })}
                />
                <CriteriaBuilder
                  label="Exclusion"
                  tone="exclude"
                  items={config.exclusion}
                  onChange={(exclusion) => updateConfig({ exclusion })}
                  codes={config.exclusionCodes}
                  onCodeChange={(item, code) => updateConfig({ exclusionCodes: { ...config.exclusionCodes, [item]: code } })}
                  justifications={config.justifications}
                  onJustify={(item, text) => updateConfig({ justifications: { ...config.justifications, [item]: text } })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
                <p className="text-[12px] text-ink-muted">
                  Each exclusion criterion carries an ineligibility code used in screening and the PRISMA flow.
                </p>
                <GuideRef>{GUIDE_REFS.codes}</GuideRef>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Extraction schema</CardTitle>
              <CardDescription>Field sets the extraction module maps entities to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(Object.keys(SCHEMA_LABELS) as SchemaKey[]).map((key) => {
                const locked = key === "annex8";
                const on = locked || config.schemas[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-disabled={locked}
                    title={locked ? "Annex 8 is the required output and cannot be turned off" : undefined}
                    onClick={() => !locked && updateConfig({ schemas: { ...config.schemas, [key]: !on } })}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-all",
                      locked ? "cursor-default" : "cursor-pointer",
                      on ? "border-brand-300 bg-brand-50/60" : "border-line bg-white hover:bg-cream",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white",
                        locked && "opacity-70",
                      )}
                    >
                      {on && (locked ? <Lock className="size-3" strokeWidth={2.5} /> : <Check className="size-3.5" strokeWidth={3} />)}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-ink">{SCHEMA_LABELS[key]}</span>
                        {locked && <Badge variant="solid">Required output</Badge>}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">
                        {SCHEMA_DESCRIPTIONS[key]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <EffectMeasureCard />

          <Card>
            <CardHeader>
              <CardTitle>Stakeholder priority categories</CardTitle>
              <CardDescription>
                Analyst-selected categories used as tagging criteria for extracted outcome and population fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {STAKEHOLDER_CATEGORIES.map((c) => {
                const on = config.stakeholderCategories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      updateConfig({
                        stakeholderCategories: on
                          ? config.stakeholderCategories.filter((x) => x !== c.id)
                          : [...config.stakeholderCategories, c.id],
                      })
                    }
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                      on ? "border-brand-300 bg-brand-50/60" : "border-line bg-white hover:bg-cream",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
                        on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white",
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="text-[13px] font-medium text-ink">{c.name}</span>
                        <Badge variant={c.mappable === "Yes" ? "default" : "slate"} className="text-[10.5px]">
                          {c.mappable === "Yes" ? `Maps to ${c.mappableNote}` : "Rarely maps to RCT data"}
                        </Badge>
                      </span>
                      <span className="block text-[11.5px] text-ink-muted">{c.themes.join(", ")}</span>
                      {on && c.mappable === "Rarely" && (
                        <span className="mt-0.5 block text-[11.5px] text-[#854408]">
                          Few RCT outcomes map to this category; tags may be sparse.
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <p className="pt-1 text-[11.5px] leading-snug text-ink-muted">
                This prototype does not perform ELSI assessment. It uses analyst-selected categories as tagging criteria.
              </p>
              <p className="text-[11px] leading-snug text-[#854408]">
                Placeholder list (unverified): category names and themes must be checked against the 2022 Philippine
                Social Values guidelines.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-cream/60 p-5">
            <div className="text-[12.5px] font-medium text-ink-soft">Search sources (analyst-supplied)</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {["PubMed / MEDLINE", "Cochrane CENTRAL", "Embase", "HERDIN (PH)"].map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <StageFooter pinned note="All fields are saved automatically.">
        <Button
          onClick={() => {
            updateConfig({ configured: true });
            navigate("/review/screening");
          }}
        >
          Start screening
          <ArrowRight />
        </Button>
      </StageFooter>
    </PageContainer>
  );
}

function CriteriaBuilder({
  label,
  tone,
  items,
  onChange,
  codes,
  onCodeChange,
  justifications,
  onJustify,
}: {
  label: string;
  tone: "include" | "exclude";
  items: string[];
  onChange: (items: string[]) => void;
  codes?: Record<string, IneligibilityCode>;
  onCodeChange?: (item: string, code: IneligibilityCode) => void;
  justifications: Record<string, string>;
  onJustify: (item: string, text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [justifying, setJustifying] = useState<string | null>(null);
  const [justDraft, setJustDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) {
      onChange([...items, v]);
      if (onCodeChange && !codes?.[v]) onCodeChange(v, "Other");
    }
    setDraft("");
  };
  const openJustify = (item: string) => {
    setJustDraft(justifications[item] ?? "");
    setJustifying(item);
  };
  const saveJustify = () => {
    if (justifying) onJustify(justifying, justDraft.trim());
    setJustifying(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("size-2 rounded-full", tone === "include" ? "bg-brand-500" : "bg-coral")} />
        <Label>{label}</Label>
        <span className="text-[12px] text-ink-muted">({items.length})</span>
      </div>
      <div className="flex min-h-[112px] flex-wrap content-start gap-1.5 rounded-lg border border-dashed border-line bg-cream/50 p-2.5">
        {items.map((it) => {
          const needs = needsJustification(it);
          const justified = !!justifications[it];
          return (
            <span
              key={it}
              className={cn(
                "group inline-flex animate-fade-in items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-[12.5px]",
                tone === "include"
                  ? "border-brand-200 bg-white text-brand-800"
                  : "border-coral/30 bg-white text-[#991b1b]",
              )}
            >
              {needs && !justified && (
                <span className="size-1.5 shrink-0 rounded-full bg-flag" title="No justification recorded" />
              )}
              {it}
              {codes && onCodeChange && (
                <CodeMenu value={codes[it] ?? "Other"} onChange={(c) => onCodeChange(it, c)} label={it} />
              )}
              {needs && (
                <button
                  type="button"
                  onClick={() => openJustify(it)}
                  title={justified ? `Justification: ${justifications[it]}` : GUIDE_REFS.searchDetail}
                  className={cn(
                    "ml-0.5 shrink-0 cursor-pointer whitespace-nowrap text-[11px] font-medium underline-offset-2 hover:underline",
                    justified ? "text-brand-700" : "text-[#b45309]",
                  )}
                >
                  {justified ? "Justified" : "Add justification"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== it))}
                className="grid size-4 cursor-pointer place-items-center rounded-full opacity-50 hover:bg-cream-dark hover:opacity-100"
                aria-label={`Remove ${it}`}
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
      </div>
      {justifying && (
        <div className="mt-2 animate-fade-in rounded-lg border border-flag/35 bg-flag-soft/40 p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11.5px] font-medium text-[#854408]">Justification · {justifying}</span>
            <GuideRef className="shrink-0" title={GUIDE_REFS.searchDetail}>
              Guide p. 16; Table 5, p. 22
            </GuideRef>
          </div>
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={justDraft}
              onChange={(e) => setJustDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveJustify();
                if (e.key === "Escape") setJustifying(null);
              }}
              placeholder="Why is this restriction justified for this review?"
              className="h-8 bg-white text-[12.5px]"
            />
            <Button size="sm" onClick={saveJustify}>
              Save
            </Button>
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Add ${label.toLowerCase()} criterion…`}
          className="h-8 text-[13px]"
        />
        <Button variant="outline" size="icon" onClick={add} aria-label="Add criterion">
          <Plus />
        </Button>
      </div>
    </div>
  );
}
