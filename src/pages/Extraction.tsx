import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  EyeOff,
  FileText,
  Keyboard,
  Loader2,
  Lock,
  Pencil,
  Scale,
  ScanText,
  Tag,
  Trash2,
  Undo2,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, ConfidenceBadge, ProvenanceBadge } from "@/components/ui/badge";
import { AboutAutomation } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import { HighlightContext, MockDocument, type HighlightInfo } from "@/components/extraction/MockDocument";
import { AgreementCard, DualStatusLine, canResolve } from "@/components/dualReview";
import { PROTOTYPE_CONFIG } from "@/config/prototypeConfig";
import {
  ROLE_LABELS,
  RESOLVER_ROLE,
  activeFieldIds,
  dualStatus,
  fieldAgree,
  finalFieldValue,
  tagAgree,
  useReview,
  type DualRecord,
  type DualStatus,
  type FieldVerification,
  type TagDecision,
  type TagItem,
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

type FieldFilter = "all" | "attention" | "pending" | "conflicts";

function confidenceScore(id: string, c: Confidence) {
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 997;
  const base = c === "high" ? 0.9 : c === "medium" ? 0.7 : 0.42;
  return Math.min(0.99, base + (h % 9) / 100);
}

const FIELD_STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  corrected: "Corrected",
  rejected: "Rejected",
  adjudicate: "Flagged for adjudication",
};

const describeField = (v: FieldVerification) =>
  v.status === "corrected" ? `Corrected → ${v.value}` : (FIELD_STATUS_LABEL[v.status] ?? v.status);

const TAG_STATUS_LABEL: Record<string, string> = { accepted: "Accepted", corrected: "Corrected", removed: "Removed" };
const describeTag = (v: TagDecision) =>
  v.status === "corrected" ? `Corrected → ${v.value}` : (TAG_STATUS_LABEL[v.status] ?? v.status);

const strip = <T extends object>(v: T & { at?: string; resolver?: string }): T => {
  const { at: _at, resolver: _r, ...rest } = v;
  return rest as unknown as T;
};

export default function Extraction() {
  const navigate = useNavigate();
  const {
    role,
    extractable,
    included,
    verification,
    fieldDual,
    tagDual,
    tags,
    setField,
    resolveField,
    setTag,
    resolveTag,
    acceptHighConfidence,
    applyReferenceExtraction,
    extractionAgreement,
    config,
    effectMeasures,
  } = useReview();
  const [docId, setDocId] = useState<string | undefined>(extractable[0]?.id);
  const [active, setActive] = useState<FieldId | undefined>();
  const [hovered, setHovered] = useState<FieldId | undefined>();
  const [filter, setFilter] = useState<FieldFilter>("all");
  const [editing, setEditing] = useState<FieldId | undefined>();
  const [phase, setPhase] = useState(PIPELINE_STEPS.length);

  const reviewer = role === "adjudicator" ? null : role;
  const resolverHere = canResolve(role);

  const docPaneRef = useRef<HTMLDivElement>(null);
  const fieldPaneRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef(new Map<FieldId, HTMLElement>());
  const rowRefs = useRef(new Map<FieldId, HTMLDivElement>());

  const activeIds = useMemo(() => activeFieldIds(config.schemas, effectMeasures), [config.schemas, effectMeasures]);
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
  const recOf = (id: FieldId) => (doc ? fieldDual[doc.id]?.[id] : undefined);
  const dualOf = (id: FieldId): DualStatus => dualStatus(recOf(id), fieldAgree);
  /** What the current role sees as the field decision: own commit, or the final value for the adjudicator. */
  const viewOf = (id: FieldId): FieldVerification | undefined =>
    reviewer ? recOf(id)?.[reviewer] : doc ? verification[doc.id]?.[id] : undefined;
  const statusOf = (id: FieldId) => viewOf(id)?.status ?? "pending";

  const docTags = tags.filter((t) => t.studyId === doc?.id);
  const tagFor = (id: FieldId) => docTags.find((t) => t.fieldId === id);

  const docStats = (s: CandidateStudy) => {
    const v = verification[s.id] ?? {};
    const t = tags.filter((x) => x.studyId === s.id);
    const total = activeIds.size + t.length;
    const done = [...activeIds].filter((id) => v[id]).length + t.filter((x) => x.final).length;
    return { total, done };
  };

  const committed = fields.filter((f) => statusOf(f.def.id) !== "pending").length;
  const batchAccepted = fields.filter((f) => viewOf(f.def.id)?.batch && statusOf(f.def.id) === "accepted").length;
  const conflictIds = fields.filter((f) => dualOf(f.def.id) === "conflict").map((f) => f.def.id);
  const tagConflicts = docTags.filter((t) => t.status === "conflict").map((t) => t.fieldId);
  const conflictSet = new Set([...conflictIds, ...tagConflicts]);
  const attention = fields.filter((f) => f.confidence !== "high" && statusOf(f.def.id) === "pending").length;
  const highPending = reviewer
    ? fields.filter((f) => f.confidence === "high" && statusOf(f.def.id) === "pending").length
    : 0;

  const visibleFields = fields.filter((f) => {
    if (filter === "attention") return f.confidence !== "high" || statusOf(f.def.id) === "adjudicate";
    if (filter === "pending") return statusOf(f.def.id) === "pending";
    if (filter === "conflicts") return conflictSet.has(f.def.id);
    return true;
  });

  const allDocsDone =
    extractable.length > 0 &&
    extractable.every((s) => {
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
        status: statusOf(f.def.id),
      };
    }
    return info;
  }, [fields, fieldDual, verification, reviewer, doc]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Resolution applies on conflicts for the resolver role; otherwise the reviewer's own commit. */
  const isResolving = (id: FieldId) => resolverHere && (dualOf(id) === "conflict" || dualOf(id) === "resolved");
  const isLocked = (id: FieldId) => {
    if (isResolving(id)) return false;
    const rec = recOf(id);
    return !reviewer || !!(rec?.A && rec?.B);
  };

  const act = useCallback(
    (id: FieldId, v: FieldVerification) => {
      if (!doc) return;
      if (isResolving(id)) {
        if (v.status !== "pending") resolveField(doc.id, id, v);
      } else if (!isLocked(id)) setField(doc.id, id, v);
      setEditing(undefined);
    },
    [doc, setField, resolveField, fieldDual, role], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const actTag = (id: FieldId, v: TagDecision | null) => {
    if (!doc) return;
    const rec = tagDual[doc.id]?.[id];
    const st = dualStatus(rec, tagAgree);
    if (resolverHere && (st === "conflict" || st === "resolved")) {
      if (v) resolveTag(doc.id, id, v);
    } else if (reviewer && !(rec?.A && rec?.B)) setTag(doc.id, id, v);
  };

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
      if (!active || isLocked(active)) return;
      const k = e.key.toLowerCase();
      if (k === "a") act(active, { status: "accepted" });
      else if (k === "r") act(active, { status: "rejected" });
      else if (k === "d" && !isResolving(active)) act(active, { status: "adjudicate" });
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
  }, [active, visibleFields, revealed, doc, act, selectFromForm]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc || !doc.trial) {
    return (
      <div className="mx-auto max-w-[1120px] px-8 py-8">
        <PageHeader step="Stage 4 of 6" title="Extraction & verification" />
        <Card className="py-16 text-center">
          <ScanText className="mx-auto size-10 text-brand-300" />
          <div className="mt-3 text-[15px] font-medium text-ink">No trial reports to extract</div>
          <p className="mt-1 text-[13px] text-ink-muted">
            Only the resolved included set reaches extraction. Include randomised trials during screening to extract data here.
          </p>
          <Button className="mt-5" variant="outline" onClick={() => navigate("/review/screening")}>
            <ArrowLeft /> Back to screening
          </Button>
        </Card>
      </div>
    );
  }

  const confidenceCounts: Record<Confidence, number> = { high: 0, medium: 0, low: 0 };
  for (const f of fields) confidenceCounts[f.confidence]++;
  const docIndex = extractable.findIndex((s) => s.id === doc.id);
  const nextDoc = extractable[docIndex + 1];
  const nonExtractable = included.length - extractable.length;
  const docDone = docStats(doc);

  return (
    <div className="mx-auto flex max-w-[1560px] flex-col px-4 sm:px-6 lg:px-8 py-6 lg:py-8 xl:h-[calc(100dvh-var(--topbar-h))] xl:py-4">
      <PageHeader
        className="shrink-0 pb-3 [&_p]:mt-1 [&_p]:truncate"
        step="Stage 4 of 6 · Core module"
        title="Extraction & verification"
        badges={
          <>
            <Badge variant="default" className="whitespace-nowrap">
              <ScanText /> Layout-aware NER
            </Badge>
            <Badge variant="amber" className="whitespace-nowrap">
              <UserRound /> Dual human verification
            </Badge>
            <AboutAutomation text="Values are extracted using layout-aware parsing and a fine-tuned entity recognition model, mapped to Annex 8, CONSORT, and PRISMA fields. Two reviewers verify every value independently; conflicts are resolved before synthesis." />
          </>
        }
        description="Each reviewer verifies every extracted value against its highlighted source; only agreed or resolved values enter synthesis."
      />

      {/* Document tabs + agreement */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
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
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-all",
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
                  {st.done}/{st.total} resolved
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
        <AgreementCard stage="extraction" stats={extractionAgreement} compact className="min-w-[420px] flex-1" />
      </div>

      {/* Verification strip */}
      <div className="mb-3 max-w-full shrink-0 overflow-x-auto">
        <Card className="grid min-h-14 min-w-[640px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-x divide-line">
          <div className="flex items-center gap-3 px-4 xl:px-5 py-2">
            <div className="shrink-0 leading-tight">
              <div className="text-[11.5px] text-ink-muted">
                {reviewer ? `Committed by ${ROLE_LABELS[reviewer]}` : "Fields resolved"}
              </div>
              {batchAccepted > 0 && (
                <div
                  className="whitespace-nowrap text-[11px] tabular text-ink-soft"
                  title="Fields accepted with the batch action are logged separately from individually verified fields"
                >
                  {committed - batchAccepted} verified · {batchAccepted} accepted in batch
                </div>
              )}
              {!reviewer && conflictIds.length > 0 && (
                <div className="whitespace-nowrap text-[11px] tabular text-coral">
                  {conflictIds.length + tagConflicts.length} open conflict{conflictIds.length + tagConflicts.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
            <div className="shrink-0 text-[20px] font-semibold leading-none tabular text-ink">
              <AnimatedNumber value={committed} />
              <span className="text-[14px] font-normal text-ink-muted">/{fields.length}</span>
            </div>
            <Progress value={(committed / Math.max(1, fields.length)) * 100} className="h-1 min-w-10 flex-1" />
          </div>
          <div className="flex items-center gap-3 px-4 xl:px-5 py-2">
            <div className="shrink-0 text-[11.5px] text-ink-muted">Model confidence</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] tabular text-ink-soft">
              <span>
                <span className="text-[18px] font-semibold text-brand-700">{confidenceCounts.high}</span> high
              </span>
              <span className="text-ink-muted">·</span>
              <span>
                <span className="text-[18px] font-semibold text-[#b45309]">{confidenceCounts.medium}</span> medium
              </span>
              <span className="text-ink-muted">·</span>
              <span className="flex items-center gap-1.5">
                <span>
                  <span className="text-[18px] font-semibold text-coral">{confidenceCounts.low}</span> low
                </span>
                {confidenceCounts.low > 0 && (
                  <span className="whitespace-nowrap rounded border border-coral/40 bg-coral-soft px-1.5 py-px text-[10.5px] font-medium text-coral">
                    review first
                  </span>
                )}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 gap-4 xl:min-h-[280px] xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] xl:grid-rows-[minmax(0,1fr)]">
        {/* Left: document */}
        <Card className="relative flex h-[75vh] min-h-[520px] flex-col overflow-hidden bg-[#eeebe3] xl:h-auto xl:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <FileText className="size-4 shrink-0 text-coral" />
              <span className="truncate font-medium text-ink">
                {doc.trial.acronym}_{doc.year}_full-text.pdf
              </span>
              <span className="shrink-0 text-ink-muted">· 2 pages</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-ink-muted">
              <Legend cls="bg-brand-100 ring-brand-400" label="High" />
              <Legend cls="bg-flag-soft ring-[#b45309]" label="Medium" />
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
        <Card className="flex h-[75vh] min-h-[520px] flex-col overflow-hidden xl:h-auto xl:min-h-0">
          <div className="shrink-0 border-b border-line px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink" title={doc.title}>{doc.title}</div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-ink-muted">
                  Schema:
                  {enabledSchemas.map((k) => (
                    <Badge key={k} variant="neutral" className="text-[10.5px]">
                      {SCHEMA_LABELS[k]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Segmented<FieldFilter>
                className="shrink-0 whitespace-nowrap"
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${fields.length}` },
                  { value: "attention", label: `Needs attention ${attention}` },
                  { value: "pending", label: `Pending ${fields.length - committed}` },
                  { value: "conflicts", label: `Conflicts ${conflictSet.size}` },
                ]}
              />
              {reviewer && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!revealed || highPending === 0}
                  onClick={() => acceptHighConfidence([doc.id])}
                >
                  <CheckCheck /> Accept {highPending} high-confidence
                </Button>
              )}
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
              FIELD_GROUPS.map((g, gIdx) => {
                const groupFields = visibleFields.filter((f) => f.def.group === g);
                if (groupFields.length === 0) return null;
                return (
                  <div key={g} className={cn("mb-5", gIdx > 0 && "pt-2 border-t border-line/60")}>
                    <div className="mb-2 px-0.5 text-[11px] font-semibold tracking-wider uppercase text-ink-muted">
                      {g}
                    </div>
                    <div className="space-y-2">
                      {groupFields.map((f, i) => {
                        const t = tagFor(f.def.id);
                        return (
                          <FieldRow
                            key={f.def.id}
                            field={f}
                            index={i}
                            enabledSchemas={enabledSchemas}
                            v={viewOf(f.def.id)}
                            rec={recOf(f.def.id)}
                            dual={dualOf(f.def.id)}
                            reviewerMode={!!reviewer}
                            resolving={isResolving(f.def.id)}
                            locked={isLocked(f.def.id)}
                            active={active === f.def.id}
                            hovered={hovered === f.def.id}
                            editing={editing === f.def.id}
                            tag={t}
                            tagRec={t ? tagDual[doc.id]?.[f.def.id] : undefined}
                            resolverHere={resolverHere}
                            rowRef={(el) => {
                              if (el) rowRefs.current.set(f.def.id, el);
                              else rowRefs.current.delete(f.def.id);
                            }}
                            onSelect={() => selectFromForm(f.def.id)}
                            onHover={(h) => setHovered(h ? f.def.id : undefined)}
                            onAct={(v) => act(f.def.id, v)}
                            onResolve={(v) => resolveField(doc.id, f.def.id, v)}
                            onEdit={(on) => setEditing(on ? f.def.id : undefined)}
                            onTag={(v) => actTag(f.def.id, v)}
                          />
                        );
                      })}
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

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-cream/60 px-4 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-ink-muted [&>span]:whitespace-nowrap">
              <Keyboard className="size-3.5 shrink-0" />
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> move ·
              </span>
              <span>
                <Kbd>A</Kbd> accept ·
              </span>
              <span>
                <Kbd>C</Kbd> correct ·
              </span>
              <span>
                <Kbd>R</Kbd> reject ·
              </span>
              <span>
                <Kbd>D</Kbd> adjudicate
              </span>
            </div>
            {docDone.done >= docDone.total && nextDoc ? (
              <Button size="sm" onClick={() => setDocId(nextDoc.id)}>
                Next document <ArrowRight />
              </Button>
            ) : (
              <span className="shrink-0 whitespace-nowrap text-[12px] tabular text-ink-soft">
                {docDone.total - docDone.done} unresolved
              </span>
            )}
          </div>
        </Card>
      </div>

      <StageFooter
        className="mt-4 shrink-0 pt-3 xl:mt-3 xl:pt-2.5"
        note={
          allDocsDone
            ? "Every field and tag is resolved. Resolved values will be used for synthesis."
            : `${remainingTotal} field(s) and tag(s) not yet resolved across ${extractable.length} ${extractable.length === 1 ? "document" : "documents"}; every item must be agreed or resolved before synthesis.`
        }
      >
        <button
          type="button"
          onClick={applyReferenceExtraction}
          title="Demo shortcut: fills both reviewers' remaining field and tag decisions with reference decisions, including a few disagreements to resolve"
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-line bg-cream/40 px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          <Wand2 className="size-3.5 shrink-0" />
          Demo shortcut: fill remaining with reference decisions
        </button>
        <Button size="lg" disabled={!allDocsDone} onClick={() => navigate("/review/synthesis")}>
          Proceed to synthesis
          <ArrowRight />
        </Button>
      </StageFooter>
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

function FieldRow({
  field,
  index,
  enabledSchemas,
  v,
  rec,
  dual,
  reviewerMode,
  resolving,
  locked,
  active,
  hovered,
  editing,
  tag,
  tagRec,
  resolverHere,
  rowRef,
  onSelect,
  onHover,
  onAct,
  onResolve,
  onEdit,
  onTag,
}: {
  field: ExtractedField;
  index: number;
  enabledSchemas: SchemaKey[];
  v?: FieldVerification;
  rec?: DualRecord<FieldVerification>;
  dual: DualStatus;
  reviewerMode: boolean;
  resolving: boolean;
  locked: boolean;
  active: boolean;
  hovered: boolean;
  editing: boolean;
  tag?: TagItem;
  tagRec?: DualRecord<TagDecision>;
  resolverHere: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  onAct: (v: FieldVerification) => void;
  onResolve: (v: FieldVerification) => void;
  onEdit: (on: boolean) => void;
  onTag: (v: TagDecision | null) => void;
}) {
  const shown = resolving ? rec?.resolved : v;
  const status = shown?.status ?? "pending";
  const [draft, setDraft] = useState(field.extracted);
  const inputRef = useRef<HTMLInputElement>(null);
  const score = confidenceScore(field.def.id + field.extracted, field.confidence);
  const final = finalFieldValue(field.extracted, shown);
  const hidden = PROTOTYPE_CONFIG.hideSuggestionsUntilCommit && reviewerMode && !v;
  const showActions = !editing && !locked && (status === "pending" || (resolving && dual === "conflict"));

  useEffect(() => {
    if (editing) {
      setDraft(shown?.status === "corrected" ? (shown.value ?? field.extracted) : field.extracted);
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
        dual === "conflict" && !active && "border-coral/40 bg-coral-soft/15",
        dual !== "conflict" && status === "accepted" && !active && "border-brand-200 bg-brand-50/30",
        dual !== "conflict" && status === "corrected" && !active && "border-sky-200 bg-sky-50/40 animate-flash",
        dual !== "conflict" && status === "rejected" && !active && "border-coral/25 bg-coral-soft/20 opacity-70",
        dual !== "conflict" && status === "adjudicate" && !active && "border-flag/35 bg-flag-soft/35",
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
          {hidden ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-ink-muted"
              title="Model confidence is hidden until you commit this field"
            >
              <EyeOff className="size-3" /> Confidence hidden
            </span>
          ) : (
            <ConfidenceBadge confidence={field.confidence} score={score} />
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <ProvenanceBadge source={field.def.source} />
          {field.def.schemas
            .filter((s) => enabledSchemas.includes(s.key))
            .map((s) => (
              <span key={s.key} className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[10.5px] text-ink-muted">
                {s.key === "annex8" ? s.item : `${SCHEMA_LABELS[s.key]} ${s.item}`}
              </span>
            ))}
        </div>

        {showActions ? (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {resolving && <span className="mr-1 text-[10.5px] font-medium text-[#991b1b]">Final:</span>}
            <ActionBtn title="Accept (A)" tone="accept" onClick={() => onAct({ status: "accepted" })}>
              <Check /> Accept
            </ActionBtn>
            <ActionBtn title="Correct (C)" tone="correct" onClick={() => onEdit(true)}>
              <Pencil />
            </ActionBtn>
            <ActionBtn title="Reject (R)" tone="reject" onClick={() => onAct({ status: "rejected" })}>
              <X />
            </ActionBtn>
            {!resolving && (
              <ActionBtn title="Flag for adjudication (D)" tone="adjudicate" onClick={() => onAct({ status: "adjudicate" })}>
                <Scale />
              </ActionBtn>
            )}
          </div>
        ) : !editing && status !== "pending" ? (
          <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <StatusPill status={status} batch={shown?.batch} />
            {locked ? (
              reviewerMode && (
                <span className="flex items-center gap-1 text-[10.5px] text-ink-muted" title="Both reviewers have committed">
                  <Lock className="size-3" /> Committed
                </span>
              )
            ) : !resolving ? (
              <button
                type="button"
                title="Withdraw (allowed until the other reviewer commits)"
                onClick={() => onAct({ status: "pending" })}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-ink-muted hover:bg-cream-dark hover:text-ink"
              >
                <Undo2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : !editing && !reviewerMode && dual !== "conflict" ? (
          <span className="text-[11px] text-ink-muted">Awaiting both reviewers</span>
        ) : null}
      </div>

      {(rec?.A || rec?.B) && (
        <div
          className={cn(
            "mt-2 rounded-md border px-2.5 py-1.5",
            dual === "conflict" ? "border-coral/35 bg-coral-soft/30" : "border-line bg-cream/50",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DualStatusLine rec={rec} status={dual} describe={describeField} />
          {resolving && dual === "conflict" && rec?.A && rec?.B && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className="flex items-center gap-1 font-medium text-[#991b1b]">
                <Scale className="size-3.5" /> Resolve:
              </span>
              <ResolveChoice label={`Use Reviewer A · ${describeField(rec.A)}`} onClick={() => onResolve(strip(rec.A!))} />
              <ResolveChoice label={`Use Reviewer B · ${describeField(rec.B)}`} onClick={() => onResolve(strip(rec.B!))} />
            </div>
          )}
        </div>
      )}

      {tag && (
        <TagRow
          tag={tag}
          rec={tagRec}
          reviewerMode={reviewerMode}
          resolverHere={resolverHere}
          hidden={PROTOTYPE_CONFIG.hideSuggestionsUntilCommit && reviewerMode && !v}
          onTag={onTag}
        />
      )}
    </div>
  );
}

function ResolveChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      size="xs"
      variant="outline"
      className="max-w-[260px]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="truncate">{label}</span>
    </Button>
  );
}

function TagRow({
  tag,
  rec,
  reviewerMode,
  resolverHere,
  hidden,
  onTag,
}: {
  tag: TagItem;
  rec?: DualRecord<TagDecision>;
  reviewerMode: boolean;
  resolverHere: boolean;
  hidden: boolean;
  onTag: (v: TagDecision | null) => void;
}) {
  const { role } = useReview();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.label);
  const st = dualStatus(rec, tagAgree);
  const resolving = resolverHere && (st === "conflict" || st === "resolved");
  const mine = reviewerMode && role !== "adjudicator" ? rec?.[role] : undefined;
  const shown = resolving ? rec?.resolved : reviewerMode ? mine : tag.final;
  const locked = !resolving && (!reviewerMode || !!(rec?.A && rec?.B));
  const canAct = !locked && (!shown || (resolving && st === "conflict"));
  const text = shown?.status === "corrected" ? shown.value : tag.label;

  return (
    <div
      className="mt-2 rounded-md border border-dashed border-brand-200 bg-brand-50/30 px-2.5 py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
        <span className="flex items-center gap-1 font-semibold text-ink-soft">
          <Tag className="size-3 text-brand-600" /> Stakeholder tag
        </span>
        <span className="text-[10.5px] text-ink-muted">rule-based, not benchmarked</span>
        {hidden ? (
          <span className="flex items-center gap-1 text-ink-muted">
            <EyeOff className="size-3" /> Suggestion hidden until you commit this field
          </span>
        ) : editing ? (
          <form
            className="flex min-w-[260px] flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              onTag({ status: "corrected", value: draft.trim() || tag.label });
              setEditing(false);
            }}
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 bg-white text-[12px]" autoFocus />
            <Button type="submit" size="xs">
              Save
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <span
              className={cn(
                "rounded-full border px-2 py-px font-medium",
                shown?.status === "removed"
                  ? "border-line bg-white text-ink-muted line-through"
                  : "border-brand-200 bg-white text-brand-800",
              )}
            >
              {text}
            </span>
            {!shown && <Badge variant="slate">Suggested</Badge>}
            {shown && (
              <Badge variant={shown.status === "removed" ? "slate" : shown.status === "corrected" ? "amber" : "default"}>
                {TAG_STATUS_LABEL[shown.status]}
              </Badge>
            )}
            {canAct && (
              <span className="ml-auto flex items-center gap-1">
                {resolving && <span className="text-[10.5px] font-medium text-[#991b1b]">Final:</span>}
                <Button size="xs" variant="outline" onClick={() => onTag({ status: "accepted" })}>
                  <Check /> Accept
                </Button>
                <Button size="xs" variant="ghost" title="Correct tag" onClick={() => setEditing(true)}>
                  <Pencil />
                </Button>
                <Button size="xs" variant="ghost" title="Remove tag" onClick={() => onTag({ status: "removed" })}>
                  <Trash2 />
                </Button>
              </span>
            )}
            {!canAct && shown && !locked && !resolving && (
              <button
                type="button"
                title="Withdraw"
                onClick={() => onTag(null)}
                className="ml-auto grid size-5 cursor-pointer place-items-center rounded text-ink-muted hover:bg-cream-dark hover:text-ink"
              >
                <Undo2 className="size-3" />
              </button>
            )}
          </>
        )}
      </div>
      {(rec?.A || rec?.B) && !hidden && (
        <DualStatusLine rec={rec} status={st} describe={describeTag} className="mt-1" />
      )}
      {resolving && st === "conflict" && rec?.A && rec?.B && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="flex items-center gap-1 font-medium text-[#991b1b]">
            <Scale className="size-3.5" /> Resolve:
          </span>
          <ResolveChoice label={`Use Reviewer A · ${describeTag(rec.A)}`} onClick={() => onTag(strip(rec.A!))} />
          <ResolveChoice label={`Use Reviewer B · ${describeTag(rec.B)}`} onClick={() => onTag(strip(rec.B!))} />
        </div>
      )}
      {!reviewerMode && !rec?.A && !rec?.B && (
        <div className="mt-0.5 text-[10.5px] text-ink-muted">
          Awaiting both reviewers · resolved by {ROLE_LABELS[RESOLVER_ROLE].toLowerCase()} on conflict
        </div>
      )}
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
    reject: "border-line bg-white text-ink-soft hover:border-coral hover:text-[#991b1b] w-7",
    adjudicate: "border-line bg-white text-ink-soft hover:border-[#b45309] hover:text-[#854408] w-7",
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

function StatusPill({ status, batch }: { status: string; batch?: boolean }) {
  const map: Record<string, { cls: string; label: string }> = {
    accepted: batch
      ? { cls: "bg-brand-100 text-brand-800 ring-1 ring-brand-300", label: "Accepted in batch" }
      : { cls: "bg-brand-600 text-white", label: "Accepted" },
    corrected: { cls: "bg-sky-700 text-white", label: "Corrected" },
    rejected: { cls: "bg-coral text-white", label: "Rejected" },
    adjudicate: { cls: "bg-[#b45309] text-white", label: "Flagged" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={cn("inline-flex animate-fade-in items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-xs", s.cls)}>
      {status === "accepted" && <Check className="size-3" strokeWidth={3} />}
      {s.label}
    </span>
  );
}
