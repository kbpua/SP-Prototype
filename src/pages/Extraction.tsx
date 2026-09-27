import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  FileText,
  Keyboard,
  Loader2,
  MapPin,
  Pencil,
  Scale,
  ScanText,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import { HighlightContext, MockDocument, type HighlightInfo } from "@/components/extraction/MockDocument";
import {
  activeFieldIds,
  finalFieldValue,
  useReview,
  type FieldVerification,
} from "@/state/ReviewContext";
import {
  FIELD_GROUPS,
  SCHEMA_LABELS,
  getExtractedFields,
  type CandidateStudy,
  type Confidence,
  type ExtractedField,
  type FieldId,
  type SchemaKey,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

const processedDocs = new Set<string>();

const PIPELINE_STEPS = [
  "Parsing PDF layout — text blocks, tables, figures",
  "Layout-aware named-entity recognition",
  "Mapping entities to Annex 8 · CONSORT · PRISMA",
  "Scoring confidence and linking source spans",
];

type FieldFilter = "all" | "attention" | "pending";

function confidenceScore(id: string, c: Confidence) {
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 997;
  const base = c === "high" ? 0.9 : c === "medium" ? 0.7 : 0.42;
  return Math.min(0.99, base + (h % 9) / 100);
}

export default function Extraction() {
  const navigate = useNavigate();
  const { extractable, included, verification, setField, acceptHighConfidence, config } = useReview();
  const [docId, setDocId] = useState<string | undefined>(extractable[0]?.id);
  const [active, setActive] = useState<FieldId | undefined>();
  const [hovered, setHovered] = useState<FieldId | undefined>();
  const [filter, setFilter] = useState<FieldFilter>("all");
  const [editing, setEditing] = useState<FieldId | undefined>();
  const [phase, setPhase] = useState(PIPELINE_STEPS.length);

  const docPaneRef = useRef<HTMLDivElement>(null);
  const fieldPaneRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef(new Map<FieldId, HTMLElement>());
  const rowRefs = useRef(new Map<FieldId, HTMLDivElement>());

  const activeIds = useMemo(() => activeFieldIds(config.schemas), [config.schemas]);
  const enabledSchemas = (Object.keys(config.schemas) as SchemaKey[]).filter((k) => config.schemas[k]);

  useEffect(() => {
    if (!extractable.some((s) => s.id === docId)) setDocId(extractable[0]?.id);
  }, [extractable, docId]);

  const doc = extractable.find((s) => s.id === docId);

  // Simulated extraction pass the first time a document is opened.
  useEffect(() => {
    if (!doc) return;
    spanRefs.current.clear();
    setActive(undefined);
    setEditing(undefined);
    docPaneRef.current?.scrollTo({ top: 0 });
    fieldPaneRef.current?.scrollTo({ top: 0 });
    if (processedDocs.has(doc.id)) {
      setPhase(PIPELINE_STEPS.length);
      return;
    }
    setPhase(0);
    const timers = PIPELINE_STEPS.map((_, i) => window.setTimeout(() => setPhase(i + 1), 520 * (i + 1)));
    const done = window.setTimeout(() => processedDocs.add(doc.id), 520 * PIPELINE_STEPS.length);
    return () => [...timers, done].forEach(clearTimeout);
  }, [doc]);

  const revealed = phase >= PIPELINE_STEPS.length;

  const fields = useMemo(
    () => (doc?.trial ? getExtractedFields(doc.trial).filter((f) => activeIds.has(f.def.id)) : []),
    [doc, activeIds],
  );
  const docVerification = (doc && verification[doc.id]) ?? {};
  const statusOf = (id: FieldId) => docVerification[id]?.status ?? "pending";

  const docStats = (s: CandidateStudy) => {
    const v = verification[s.id] ?? {};
    const total = activeIds.size;
    const done = [...activeIds].filter((id) => (v[id]?.status ?? "pending") !== "pending").length;
    return { total, done };
  };

  const resolved = fields.filter((f) => statusOf(f.def.id) !== "pending").length;
  const attention = fields.filter((f) => f.confidence !== "high" && statusOf(f.def.id) === "pending").length;
  const highPending = fields.filter((f) => f.confidence === "high" && statusOf(f.def.id) === "pending").length;

  const visibleFields = fields.filter((f) => {
    if (filter === "attention") return f.confidence !== "high" || statusOf(f.def.id) === "adjudicate";
    if (filter === "pending") return statusOf(f.def.id) === "pending";
    return true;
  });

  const allDocsDone = extractable.length > 0 && extractable.every((s) => {
    const st = docStats(s);
    return st.done >= st.total;
  });
  const remainingTotal = extractable.reduce((acc, s) => {
    const st = docStats(s);
    return acc + (st.total - st.done);
  }, 0);

  const scrollWithin = (container: HTMLElement | null, el: HTMLElement | undefined) => {
    if (!container || !el) return;
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      container.clientHeight / 2 +
      el.offsetHeight / 2;
    container.scrollTo({ top, behavior: "smooth" });
  };

  const selectFromForm = useCallback((id: FieldId) => {
    setActive(id);
    scrollWithin(docPaneRef.current, spanRefs.current.get(id));
  }, []);

  const selectFromDoc = useCallback((id: FieldId) => {
    setActive(id);
    scrollWithin(fieldPaneRef.current, rowRefs.current.get(id));
  }, []);

  const highlightInfo = useMemo(() => {
    const info: Partial<Record<FieldId, HighlightInfo>> = {};
    for (const f of fields) {
      info[f.def.id] = {
        label: f.def.label,
        confidence: f.confidence,
        status: docVerification[f.def.id]?.status ?? "pending",
      };
    }
    return info;
  }, [fields, docVerification]);

  const act = useCallback(
    (id: FieldId, v: FieldVerification) => {
      if (!doc) return;
      setField(doc.id, id, v);
      setEditing(undefined);
    },
    [doc, setField],
  );

  // Keyboard: ↑/↓ move between fields, A accept, C correct, R reject, D adjudicate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !revealed || !doc) return;
      const ids = visibleFields.map((f) => f.def.id);
      const idx = active ? ids.indexOf(active) : -1;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = ids[Math.max(0, Math.min(ids.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next) {
          selectFromForm(next);
          scrollWithin(fieldPaneRef.current, rowRefs.current.get(next));
        }
        return;
      }
      if (!active) return;
      const k = e.key.toLowerCase();
      if (k === "a") act(active, { status: "accepted" });
      else if (k === "r") act(active, { status: "rejected" });
      else if (k === "d") act(active, { status: "adjudicate" });
      else if (k === "c") {
        e.preventDefault();
        setEditing(active);
      } else return;
      if (k !== "c") {
        const next = ids[idx + 1];
        if (next) {
          selectFromForm(next);
          scrollWithin(fieldPaneRef.current, rowRefs.current.get(next));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, visibleFields, revealed, doc, act, selectFromForm]);

  if (!doc || !doc.trial) {
    return (
      <div className="mx-auto max-w-[1120px] px-8 py-8">
        <PageHeader step="Stage 4 of 6" title="Extraction & verification" />
        <Card className="py-16 text-center">
          <ScanText className="mx-auto size-10 text-brand-300" />
          <div className="mt-3 text-[15px] font-medium text-ink">No trial reports to extract</div>
          <p className="mt-1 text-[13px] text-ink-muted">Include randomised trials during screening to extract data here.</p>
          <Button className="mt-5" variant="outline" onClick={() => navigate("/review/screening")}>
            <ArrowLeft /> Back to screening
          </Button>
        </Card>
      </div>
    );
  }

  const m = doc.trial.metrics;
  const docIndex = extractable.findIndex((s) => s.id === doc.id);
  const nextDoc = extractable[docIndex + 1];
  const nonExtractable = included.length - extractable.length;

  return (
    <div className="mx-auto max-w-[1560px] px-8 py-8">
      <PageHeader
        step="Stage 4 of 6 · Core module"
        title="Extraction & verification"
        badges={
          <>
            <Badge variant="default">
              <ScanText /> Layout-aware NER
            </Badge>
            <Badge variant="amber">
              <UserRound /> Human verification
            </Badge>
          </>
        }
        description="Each value is extracted from the trial report, mapped to guideline fields, and linked to its exact source location. The analyst verifies every field before it can enter synthesis."
        actions={
          <Button variant="outline" onClick={() => acceptHighConfidence(extractable.map((s) => s.id))}>
            <CheckCheck /> Accept high-confidence (all documents)
          </Button>
        }
      />

      {/* Document tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {extractable.map((s) => {
          const st = docStats(s);
          const complete = st.done >= st.total;
          const on = s.id === doc.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setDocId(s.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                on ? "border-brand-500 bg-white shadow-sm ring-2 ring-brand-500/15" : "border-line bg-white/60 hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md",
                  complete ? "bg-brand-600 text-white" : on ? "bg-brand-50 text-brand-700" : "bg-cream-dark text-ink-muted",
                )}
              >
                {complete ? <Check className="size-3.5" strokeWidth={3} /> : <FileText className="size-3.5" />}
              </span>
              <span>
                <span className="block text-[13px] font-semibold leading-tight text-ink">{s.trial?.acronym}</span>
                <span className="block text-[11px] tabular leading-tight text-ink-muted">
                  {st.done}/{st.total} verified
                </span>
              </span>
            </button>
          );
        })}
        {nonExtractable > 0 && (
          <span className="ml-2 text-[12px] text-ink-muted">
            + {nonExtractable} included record(s) not eligible for trial data extraction
          </span>
        )}
      </div>

      {/* Performance strip */}
      <Card className="mb-4 grid grid-cols-7 divide-x divide-line">
        <div className="col-span-2 flex flex-col justify-center px-5 py-3">
          <div className="text-[12px] font-medium text-ink-soft">Extraction benchmark · this document</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
            Compared against dual-annotator gold standard (mock evaluation)
          </div>
        </div>
        <Metric label="Precision" value={m.precision} />
        <Metric label="Recall" value={m.recall} />
        <Metric label="F1 score" value={m.f1} highlight />
        <Metric label="Cohen's κ" value={m.kappa} sub="annotator agreement" />
        <div className="flex flex-col justify-center px-5 py-3">
          <div className="text-[11.5px] text-ink-muted">Fields verified</div>
          <div className="text-[22px] font-semibold tabular text-ink">
            <AnimatedNumber value={resolved} />
            <span className="text-[14px] font-normal text-ink-muted">/{fields.length}</span>
          </div>
          <Progress value={(resolved / Math.max(1, fields.length)) * 100} className="mt-1 h-1" />
        </div>
      </Card>

      {/* Split pane */}
      <div className="grid h-[calc(100vh-150px)] min-h-[620px] grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-4">
        {/* Left: document */}
        <Card className="relative flex min-h-0 flex-col overflow-hidden bg-[#eeebe3]">
          <div className="flex items-center justify-between border-b border-line bg-white/90 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <FileText className="size-4 shrink-0 text-coral" />
              <span className="truncate font-medium text-ink">
                {doc.trial.acronym}_{doc.year}_full-text.pdf
              </span>
              <span className="shrink-0 text-ink-muted">· 2 pages</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-ink-muted">
              <Legend cls="bg-brand-100 ring-brand-400" label="High" />
              <Legend cls="bg-amber-100 ring-flag" label="Medium" />
              <Legend cls="bg-coral-soft ring-coral" label="Low" />
              <Legend cls="bg-brand-50 ring-brand-600" label="Verified" />
            </div>
          </div>
          <div ref={docPaneRef} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
            <HighlightContext.Provider
              value={{
                info: highlightInfo,
                active,
                hovered,
                revealed,
                onSelect: selectFromDoc,
                onHover: setHovered,
                register: (id, el) => {
                  const existing = spanRefs.current.get(id);
                  if (el && (!existing || !existing.isConnected)) spanRefs.current.set(id, el);
                },
              }}
            >
              <MockDocument study={doc} />
            </HighlightContext.Provider>
          </div>

          {!revealed && (
            <div className="absolute inset-0 top-[45px] grid animate-fade-in place-items-center bg-white/55 backdrop-blur-[2px]">
              <div className="w-[380px] rounded-xl border border-line bg-white p-5 shadow-lg">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <Loader2 className="size-4 animate-spin text-brand-600" />
                  Running extraction pipeline
                </div>
                <ol className="mt-3.5 space-y-2.5">
                  {PIPELINE_STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5 text-[12.5px]">
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full transition-colors",
                          i < phase ? "bg-brand-600 text-white" : i === phase ? "bg-brand-50 text-brand-700" : "bg-cream-dark text-ink-muted",
                        )}
                      >
                        {i < phase ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : i === phase ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <span className="text-[10px]">{i + 1}</span>
                        )}
                      </span>
                      <span className={cn(i <= phase ? "text-ink" : "text-ink-muted")}>{s}</span>
                    </li>
                  ))}
                </ol>
                <Progress value={(phase / PIPELINE_STEPS.length) * 100} className="mt-4" />
              </div>
            </div>
          )}
        </Card>

        {/* Right: fields */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-ink">{doc.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  Schema:
                  {enabledSchemas.map((k) => (
                    <Badge key={k} variant="neutral" className="text-[10.5px]">
                      {SCHEMA_LABELS[k]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Segmented<FieldFilter>
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${fields.length}` },
                  { value: "attention", label: `Needs attention ${attention}` },
                  { value: "pending", label: `Pending ${fields.length - resolved}` },
                ]}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!revealed || highPending === 0}
                onClick={() => acceptHighConfidence([doc.id])}
              >
                <CheckCheck /> Accept {highPending} high-confidence
              </Button>
            </div>
          </div>

          <div ref={fieldPaneRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
            {!revealed ? (
              <div className="space-y-2.5 pt-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-[74px] animate-pulse rounded-lg bg-cream-dark/60" />
                ))}
              </div>
            ) : (
              FIELD_GROUPS.map((g) => {
                const groupFields = visibleFields.filter((f) => f.def.group === g);
                if (groupFields.length === 0) return null;
                return (
                  <div key={g} className="mb-4">
                    <div className="sticky top-0 z-10 -mx-4 mb-1.5 bg-white/95 px-4 py-1.5 text-[11.5px] font-semibold tracking-wide text-ink-muted backdrop-blur">
                      {g}
                    </div>
                    <div className="space-y-2">
                      {groupFields.map((f, i) => (
                        <FieldRow
                          key={f.def.id}
                          field={f}
                          index={i}
                          enabledSchemas={enabledSchemas}
                          v={docVerification[f.def.id]}
                          active={active === f.def.id}
                          hovered={hovered === f.def.id}
                          editing={editing === f.def.id}
                          rowRef={(el) => {
                            if (el) rowRefs.current.set(f.def.id, el);
                            else rowRefs.current.delete(f.def.id);
                          }}
                          onSelect={() => selectFromForm(f.def.id)}
                          onHover={(h) => setHovered(h ? f.def.id : undefined)}
                          onAct={(v) => act(f.def.id, v)}
                          onEdit={(on) => setEditing(on ? f.def.id : undefined)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            {revealed && visibleFields.length === 0 && (
              <div className="py-16 text-center text-[13px] text-ink-muted">
                <CheckCheck className="mx-auto mb-2 size-8 text-brand-400" />
                Nothing left in this view.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line bg-cream/60 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <Keyboard className="size-3.5" />
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move · <Kbd>A</Kbd> accept · <Kbd>C</Kbd> correct · <Kbd>R</Kbd> reject · <Kbd>D</Kbd> adjudicate
            </div>
            {resolved >= fields.length && nextDoc ? (
              <Button size="sm" onClick={() => setDocId(nextDoc.id)}>
                Next document <ArrowRight />
              </Button>
            ) : (
              <span className="text-[12px] tabular text-ink-soft">
                {fields.length - resolved} remaining
              </span>
            )}
          </div>
        </Card>
      </div>

      <StageFooter
        note={
          allDocsDone
            ? "All extracted fields have been verified. Verified values will be used for synthesis."
            : `${remainingTotal} field(s) still awaiting verification across ${extractable.length} documents.`
        }
      >
        <Button size="lg" disabled={!allDocsDone} onClick={() => navigate("/review/synthesis")}>
          Proceed to synthesis
          <ArrowRight />
        </Button>
      </StageFooter>
    </div>
  );
}

function Metric({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col justify-center px-5 py-3">
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className={cn("text-[22px] font-semibold tabular", highlight ? "text-brand-700" : "text-ink")}>
        <AnimatedNumber value={value} digits={value < 1 && label !== "F1 score" ? 2 : 3} />
      </div>
      {sub && <div className="-mt-0.5 text-[10.5px] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("size-2.5 rounded-[2px] ring-[1.5px]", cls)} />
      {label}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-white px-1 font-sans text-[10.5px] font-medium text-ink-soft">{children}</kbd>
  );
}

const CONF_BADGE: Record<Confidence, { variant: "default" | "amber" | "coral"; label: string }> = {
  high: { variant: "default", label: "High" },
  medium: { variant: "amber", label: "Medium" },
  low: { variant: "coral", label: "Low" },
};

function FieldRow({
  field,
  index,
  enabledSchemas,
  v,
  active,
  hovered,
  editing,
  rowRef,
  onSelect,
  onHover,
  onAct,
  onEdit,
}: {
  field: ExtractedField;
  index: number;
  enabledSchemas: SchemaKey[];
  v?: FieldVerification;
  active: boolean;
  hovered: boolean;
  editing: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  onAct: (v: FieldVerification) => void;
  onEdit: (on: boolean) => void;
}) {
  const status = v?.status ?? "pending";
  const [draft, setDraft] = useState(field.extracted);
  const inputRef = useRef<HTMLInputElement>(null);
  const conf = CONF_BADGE[field.confidence];
  const score = confidenceScore(field.def.id + field.extracted, field.confidence);
  const final = finalFieldValue(field.extracted, v);

  useEffect(() => {
    if (editing) {
      setDraft(v?.status === "corrected" ? (v.value ?? field.extracted) : field.extracted);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={rowRef}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        "animate-stage-in cursor-pointer rounded-lg border px-3.5 py-3 transition-all duration-200",
        active
          ? "border-brand-500 bg-brand-50/40 shadow-sm ring-2 ring-brand-500/15"
          : hovered
            ? "border-brand-300 bg-white"
            : "border-line bg-white",
        status === "accepted" && !active && "border-brand-200 bg-brand-50/30",
        status === "corrected" && !active && "border-sky-200 bg-sky-50/40",
        status === "rejected" && !active && "bg-slate-50 opacity-70",
        status === "adjudicate" && !active && "border-violet-200 bg-violet-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink-muted">{field.def.label}</div>
          {editing ? (
            <form
              className="mt-1.5 flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                onAct({ status: "corrected", value: draft.trim() || field.extracted });
              }}
            >
              <Input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onEdit(false)}
                className="h-8 text-[13.5px] font-medium"
              />
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div
              className={cn(
                "mt-0.5 text-[14px] font-semibold leading-snug text-ink",
                status === "rejected" && "text-slate-400 line-through",
              )}
            >
              {status === "corrected" ? (
                <>
                  <span className="text-sky-800">{final}</span>
                  <span className="ml-2 text-[12px] font-normal text-ink-muted line-through">{field.extracted}</span>
                </>
              ) : (
                field.extracted
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={conf.variant} title="Model confidence">
            <span
              className={cn(
                "size-1.5 rounded-full",
                field.confidence === "high" ? "bg-brand-500" : field.confidence === "medium" ? "bg-flag" : "bg-coral",
              )}
            />
            {conf.label} · {Math.round(score * 100)}%
          </Badge>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            <MapPin className="size-3" />
            {field.def.source}
          </span>
          {field.def.schemas
            .filter((s) => enabledSchemas.includes(s.key))
            .map((s) => (
              <span key={s.key} className="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] text-ink-muted">
                {s.key === "annex8" ? s.item : `${SCHEMA_LABELS[s.key]} ${s.item}`}
              </span>
            ))}
        </div>

        {status === "pending" && !editing ? (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ActionBtn title="Accept (A)" tone="accept" onClick={() => onAct({ status: "accepted" })}>
              <Check /> Accept
            </ActionBtn>
            <ActionBtn title="Correct (C)" tone="correct" onClick={() => onEdit(true)}>
              <Pencil />
            </ActionBtn>
            <ActionBtn title="Reject (R)" tone="reject" onClick={() => onAct({ status: "rejected" })}>
              <X />
            </ActionBtn>
            <ActionBtn title="Send to adjudication (D)" tone="adjudicate" onClick={() => onAct({ status: "adjudicate" })}>
              <Scale />
            </ActionBtn>
          </div>
        ) : !editing ? (
          <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <StatusPill status={status} />
            <button
              type="button"
              title="Undo"
              onClick={() => onAct({ status: "pending" })}
              className="grid size-6 cursor-pointer place-items-center rounded-md text-ink-muted hover:bg-cream-dark hover:text-ink"
            >
              <Undo2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({
  tone,
  title,
  onClick,
  children,
}: {
  tone: "accept" | "correct" | "reject" | "adjudicate";
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = {
    accept: "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-600 hover:text-white hover:border-brand-600 px-2",
    correct: "border-line bg-white text-ink-soft hover:border-sky-400 hover:text-sky-700 w-7",
    reject: "border-line bg-white text-ink-soft hover:border-coral hover:text-coral w-7",
    adjudicate: "border-line bg-white text-ink-soft hover:border-violet-400 hover:text-violet-700 w-7",
  }[tone];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border text-[12px] font-medium transition-all active:scale-95 [&_svg]:size-3.5",
        cls,
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    accepted: { cls: "bg-brand-600 text-white", label: "Accepted" },
    corrected: { cls: "bg-sky-600 text-white", label: "Corrected" },
    rejected: { cls: "bg-slate-400 text-white", label: "Rejected" },
    adjudicate: { cls: "bg-violet-600 text-white", label: "Adjudication" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={cn("inline-flex animate-fade-in items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", s.cls)}>
      {status === "accepted" && <Check className="size-3" strokeWidth={3} />}
      {s.label}
    </span>
  );
}
