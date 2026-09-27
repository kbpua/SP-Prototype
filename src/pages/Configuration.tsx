import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import { useReview, type ReviewConfig } from "@/state/ReviewContext";
import { EXTRACTION_FIELDS, SCHEMA_DESCRIPTIONS, SCHEMA_LABELS, type SchemaKey } from "@/data/mockData";
import type { EffectMeasure } from "@/lib/meta";
import { cn } from "@/lib/utils";

const PICO: { key: keyof ReviewConfig; letter: string; label: string; placeholder: string }[] = [
  { key: "population", letter: "P", label: "Population", placeholder: "Who are the patients?" },
  { key: "intervention", letter: "I", label: "Intervention", placeholder: "Health technology being assessed" },
  { key: "comparator", letter: "C", label: "Comparator", placeholder: "Current standard of care, placebo…" },
  { key: "outcome", letter: "O", label: "Outcomes", placeholder: "Critical and important outcomes" },
  { key: "studyDesign", letter: "S", label: "Study design", placeholder: "e.g. Randomised controlled trials" },
];

const MEASURES: { value: EffectMeasure; label: string; desc: string }[] = [
  { value: "RR", label: "Risk ratio", desc: "Dichotomous outcomes" },
  { value: "OR", label: "Odds ratio", desc: "Dichotomous outcomes" },
  { value: "HR", label: "Hazard ratio", desc: "Time-to-event outcomes" },
  { value: "MD", label: "Mean difference", desc: "Continuous outcomes" },
];

export default function Configuration() {
  const navigate = useNavigate();
  const { config, updateConfig } = useReview();

  const schemaFieldCount = (key: SchemaKey) =>
    EXTRACTION_FIELDS.filter((f) => f.schemas.some((s) => s.key === key)).length;

  return (
    <div className="mx-auto max-w-[1120px] px-8 py-8">
      <PageHeader
        step="Stage 1 of 6"
        title="Review configuration"
        description="Define the review question using PICOS, set eligibility criteria, and choose which guideline-aligned field sets the extraction module should populate."
      />

      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Review question</CardTitle>
              <CardDescription>Structured using PICOS, as required by the Philippine HTA Methods Guide.</CardDescription>
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
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={p.key}>{p.label}</Label>
                    <Textarea
                      id={p.key}
                      rows={2}
                      className="min-h-[56px]"
                      placeholder={p.placeholder}
                      value={config[p.key] as string}
                      onChange={(e) => updateConfig({ [p.key]: e.target.value } as Partial<ReviewConfig>)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility criteria</CardTitle>
              <CardDescription>
                Criteria are embedded alongside PICOS to rank candidate studies during screening.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-5">
              <CriteriaBuilder
                label="Inclusion"
                tone="include"
                items={config.inclusion}
                onChange={(inclusion) => updateConfig({ inclusion })}
              />
              <CriteriaBuilder
                label="Exclusion"
                tone="exclude"
                items={config.exclusion}
                onChange={(exclusion) => updateConfig({ exclusion })}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Extraction schema</CardTitle>
              <CardDescription>Field sets the extraction module maps entities to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(Object.keys(SCHEMA_LABELS) as SchemaKey[]).map((key) => {
                const on = config.schemas[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateConfig({ schemas: { ...config.schemas, [key]: !on } })}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-left transition-all",
                      on ? "border-brand-300 bg-brand-50/60" : "border-line bg-white hover:bg-cream",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-ink">{SCHEMA_LABELS[key]}</span>
                        <Badge variant={on ? "default" : "neutral"}>{schemaFieldCount(key)} fields</Badge>
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

          <Card>
            <CardHeader>
              <CardTitle>Target effect measure</CardTitle>
              <CardDescription>Used as the default in synthesis. Can be changed later.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2.5">
              {MEASURES.map((m) => {
                const on = config.effectMeasure === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => updateConfig({ effectMeasure: m.value })}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 text-left transition-all",
                      on ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/15" : "border-line hover:bg-cream",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-[17px] font-semibold", on ? "text-brand-700" : "text-ink")}>
                        {m.value}
                      </span>
                      <span className="text-[12.5px] text-ink-soft">{m.label}</span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-muted">{m.desc}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-cream/60 p-5">
            <div className="text-[12.5px] font-medium text-ink-soft">Search sources (pre-configured)</div>
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

      <StageFooter note="All fields are saved automatically.">
        <Button
          size="lg"
          onClick={() => {
            updateConfig({ configured: true });
            navigate("/review/screening");
          }}
        >
          Start screening
          <ArrowRight />
        </Button>
      </StageFooter>
    </div>
  );
}

function CriteriaBuilder({
  label,
  tone,
  items,
  onChange,
}: {
  label: string;
  tone: "include" | "exclude";
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
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
        {items.map((it) => (
          <span
            key={it}
            className={cn(
              "group inline-flex animate-fade-in items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-[12.5px]",
              tone === "include"
                ? "border-brand-200 bg-white text-brand-800"
                : "border-coral/25 bg-white text-[#a33a2f]",
            )}
          >
            {it}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== it))}
              className="grid size-4 cursor-pointer place-items-center rounded-full opacity-50 hover:bg-cream-dark hover:opacity-100"
              aria-label={`Remove ${it}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
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
