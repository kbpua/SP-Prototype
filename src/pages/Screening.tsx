import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  Info,
  Pencil,
  RotateCcw,
  Sparkles,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AboutAutomation } from "@/components/ui/tooltip";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader } from "@/components/PageHeader";
import { CodeBadge, CodeChips, GUIDE_REFS, GuideRef, codeLabel } from "@/components/guide";
import {
  SCREENABLE_STUDIES,
  suggestedExclusion,
  useReview,
  type Decision,
  type PrismaCounts,
  type ScreeningDecision,
} from "@/state/ReviewContext";
import {
  INELIGIBILITY_CODES,
  RECOMMENDATION_THRESHOLDS,
  SCREENING_RATIONALES,
  SEARCH_SUMMARY,
  STUDY_DESIGNS,
  isSupportedDesign,
  type CandidateStudy,
  type IneligibilityCode,
  type StudyDesign,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

type Filter = "all" | "undecided" | "include" | "maybe" | "exclude";
type Recommendation = "include" | "review" | "exclude";

function recommendationFor(score: number): Recommendation {
  if (score >= RECOMMENDATION_THRESHOLDS.include) return "include";
  if (score >= RECOMMENDATION_THRESHOLDS.review) return "review";
  return "exclude";
}

export default function Screening() {
  const navigate = useNavigate();
  const { screening, setDecision, rationales, setRationale, designOf, setDesign, applySuggestedDecisions, prisma } =
    useReview();
  const [filter, setFilter] = useState<Filter>("all");
  const [codeFilter, setCodeFilter] = useState<IneligibilityCode | null>(null);

  const rationaleText = (id: string) => rationales[id] ?? SCREENING_RATIONALES[id] ?? "";

  const decide = (id: string, d: Decision | null) => {
    setDecision(id, d ? { decision: d } : null);
  };

  const confirmExclusion = (study: CandidateStudy, code: IneligibilityCode, note: string | undefined, edited: boolean) => {
    setDecision(study.id, {
      decision: "exclude",
      reason: edited ? codeLabel(code) : (study.suggested.reason ?? codeLabel(code)),
      code,
      codeNote: code === "Other" ? note : undefined,
      codeEdited: edited,
    });
  };

  const editRationale = (id: string, text: string | null) => {
    setRationale(id, text === null || text === SCREENING_RATIONALES[id] ? null : text);
  };

  const counts = {
    include: prisma.included,
    exclude: prisma.excluded,
    maybe: prisma.maybe,
    undecided: prisma.undecided,
  };

  const list = SCREENABLE_STUDIES.slice()
    .sort((a, b) => b.relevance - a.relevance)
    .filter((s) => {
      const d = screening[s.id];
      if (filter === "all") return true;
      if (filter === "undecided") return !d;
      if (filter === "exclude" && codeFilter) return d?.decision === "exclude" && (d.code ?? "Other") === codeFilter;
      return d?.decision === filter;
    });

  const total = prisma.screened;

  const changeFilter = (f: Filter) => {
    setFilter(f);
    if (f !== "exclude") setCodeFilter(null);
  };
  const filterByCode = (code: IneligibilityCode) => {
    if (filter === "exclude" && codeFilter === code) {
      setCodeFilter(null);
    } else {
      setFilter("exclude");
      setCodeFilter(code);
    }
  };

  // Gate: Undecided must be 0 AND at least one study Included
  const canProceed = counts.undecided === 0 && counts.include > 0;

  const handleProceed = () => {
    if (!canProceed) return;
    if (counts.maybe > 0) {
      const proceed = window.confirm(
        `${counts.maybe} ${counts.maybe === 1 ? "study is" : "studies are"} marked Maybe. Resolve them, or continue with Included studies only?`,
      );
      if (!proceed) return;
    }
    navigate("/review/appraisal");
  };

  const footerNote = useMemo(() => {
    if (counts.undecided > 0) {
      return `Resolve ${counts.undecided} undecided ${counts.undecided === 1 ? "study" : "studies"} to proceed.`;
    }
    if (counts.include === 0) {
      return "Include at least one study to proceed.";
    }
    if (counts.maybe > 0) {
      return `${counts.include} studies included (${counts.maybe} marked Maybe). Only Included studies carry forward.`;
    }
    return `${counts.include} studies will proceed to critical appraisal.`;
  }, [counts]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-4 pb-6 lg:h-[calc(100dvh-var(--topbar-h))] lg:pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] gap-5 min-w-0 lg:h-full">
        <div className="col-span-1 lg:col-span-8 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1.5 scrollbar-thin">
          <PageHeader
            className="pb-4"
            step="Stage 2 of 6"
            title="Title and abstract screening"
            badges={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default" className="whitespace-nowrap">
                  <Sparkles /> Ranked by system · analyst decides
                </Badge>
                <AboutAutomation text="Records are ranked by embedding similarity to the PICO question. The system suggests a decision, an ineligibility code, and a rationale; the analyst makes and logs every decision." />
              </div>
            }
            description="Candidate records are ranked by embedding similarity to the PICO question and eligibility criteria. Every include or exclude decision is made by the analyst and logged for the PRISMA flow diagram."
          />

          <div className="mb-2 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[12px] text-sky-900">
            <span className="flex min-w-0 items-center gap-1.5">
              <Info className="size-3.5 shrink-0 text-sky-700" />
              <span className="truncate">
                Scope: randomised trials for therapeutic-effect questions (Guide Table 2). Other designs are logged as code S.
              </span>
            </span>
            <GuideRef className="hidden shrink-0 xl:inline-flex">{GUIDE_REFS.design}</GuideRef>
          </div>

          <Card className="mb-3 px-4 py-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                <Database className="size-3.5 shrink-0 text-brand-700" />
                <span>Search strategy (imported)</span>
              </div>
              <span className="text-[10.5px] font-medium text-ink-muted bg-cream-dark/60 rounded px-2 py-0.5 border border-line">
                Analyst-supplied records
              </span>
            </div>
            <div className="truncate font-mono text-[11.5px] text-ink-soft">{SEARCH_SUMMARY.query}</div>
            <div className="mt-1 truncate text-[11px] text-ink-muted">
              Imported from analyst's search · {prisma.identified} records via RIS/CSV ·{" "}
              {SEARCH_SUMMARY.databases.map((d) => `${d.name} (${d.records})`).join(" · ")}
            </div>
          </Card>

          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="max-w-full overflow-x-auto">
              <Segmented<Filter>
                size="sm"
                value={filter}
                onChange={changeFilter}
                options={[
                  { value: "all", label: `All ${total}` },
                  { value: "undecided", label: `Undecided ${counts.undecided}` },
                  { value: "include", label: `Included ${counts.include}` },
                  { value: "maybe", label: `Maybe ${counts.maybe}` },
                  { value: "exclude", label: `Excluded ${counts.exclude}` },
                ]}
              />
            </div>
            {codeFilter ? (
              <button
                type="button"
                onClick={() => setCodeFilter(null)}
                className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-coral/30 bg-white px-2 py-0.5 text-[11.5px] text-ink-soft hover:border-coral"
              >
                Code <CodeBadge code={codeFilter} /> {codeLabel(codeFilter)}
                <X className="size-3" />
              </button>
            ) : (
              <span className="text-[11.5px] text-ink-muted whitespace-nowrap">Sorted by relevance score</span>
            )}
          </div>

          <div className="space-y-2.5 pb-8 lg:pb-2">
            {list.map((s) => (
              <StudyRow
                key={s.id}
                study={s}
                decision={screening[s.id]}
                design={designOf(s)}
                onDesign={(d) => setDesign(s.id, d)}
                rationale={rationaleText(s.id)}
                edited={s.id in rationales}
                onDecide={(d) => decide(s.id, d)}
                onConfirmExclusion={(code, note, edited) => confirmExclusion(s, code, note, edited)}
                onEditRationale={(text) => editRationale(s.id, text)}
              />
            ))}
            {list.length === 0 && (
              <div className="rounded-xl border border-dashed border-line py-14 text-center text-[13px] text-ink-muted">
                No records in this view.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-4 min-w-0 lg:min-h-0">
          <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
            <PrismaPanel prisma={prisma} activeCode={codeFilter} onCode={filterByCode} />

            {/* Dynamic CTA Block below PRISMA flow */}
            <div className="shrink-0 space-y-2 rounded-xl border border-line bg-white p-3 shadow-2xs">
              <Button
                size="lg"
                className="w-full justify-center shadow-xs"
                disabled={!canProceed}
                onClick={handleProceed}
                title={
                  counts.undecided > 0
                    ? `Resolve ${counts.undecided} undecided ${counts.undecided === 1 ? "study" : "studies"} to proceed`
                    : counts.include === 0
                      ? "Include at least one study to proceed"
                      : undefined
                }
              >
                Proceed to appraisal
                <ArrowRight className="size-4" />
              </Button>

              <div className="text-center text-[12px] text-ink-muted leading-snug px-1">
                {footerNote}
              </div>

              <button
                type="button"
                onClick={applySuggestedDecisions}
                title="Demo shortcut: fill remaining with reference decisions"
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-line px-2 py-1.5 text-[11.5px] text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700 bg-cream/40"
              >
                <Wand2 className="size-3.5 shrink-0" />
                <span className="truncate">Demo shortcut: fill remaining with reference decisions</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function relevanceTone(r: number) {
  if (r >= 0.85) return { bar: "bg-brand-600", text: "text-brand-700" };
  if (r >= 0.65) return { bar: "bg-brand-400", text: "text-brand-600" };
  return { bar: "bg-line", text: "text-ink-muted" };
}

const REC_STYLE: Record<Recommendation, { label: string; cls: string }> = {
  include: { label: "Recommend include", cls: "border-brand-200 bg-brand-50 text-brand-800" },
  review: { label: "Recommend review", cls: "border-flag/35 bg-flag-soft text-[#854408]" },
  exclude: { label: "Recommend exclude", cls: "border-coral/35 bg-coral-soft text-[#991b1b]" },
};

function StudyRow({
  study,
  decision: logged,
  design,
  onDesign,
  rationale,
  edited,
  onDecide,
  onConfirmExclusion,
  onEditRationale,
}: {
  study: CandidateStudy;
  decision?: ScreeningDecision;
  design: StudyDesign;
  onDesign: (d: StudyDesign) => void;
  rationale: string;
  edited: boolean;
  onDecide: (d: Decision | null) => void;
  onConfirmExclusion: (code: IneligibilityCode, note: string | undefined, edited: boolean) => void;
  onEditRationale: (text: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const decision = logged?.decision;
  const tone = relevanceTone(study.relevance);
  const rec = recommendationFor(study.relevance);
  const disagrees = (rec === "include" && decision === "exclude") || (rec === "exclude" && decision === "include");
  const suggestion = suggestedExclusion(study, design);
  const unsupported = !isSupportedDesign(design);

  const onExcludeClick = () => {
    if (excluding) setExcluding(false);
    else if (decision === "exclude") onDecide(null);
    else setExcluding(true);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden px-5 py-4 transition-all duration-200 hover:border-brand-200/80",
        decision === "include" && "border-brand-300 bg-brand-50/40",
        decision === "exclude" && "bg-cream/70 opacity-75 hover:opacity-100",
        decision === "maybe" && "border-flag/40",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-colors duration-300",
          decision === "include" ? "bg-brand-500" : decision === "exclude" ? "bg-coral/60" : decision === "maybe" ? "bg-flag" : "bg-transparent",
        )}
      />
      <div className="flex gap-4 sm:gap-5">
        <div className="w-32 min-w-[128px] shrink-0 pt-0.5">
          <div className={cn("text-[20px] font-semibold leading-none tabular", tone.text)}>
            {Math.round(study.relevance * 100)}
          </div>
          <div className="mt-1 text-[10.5px] text-ink-muted">relevance</div>
          <Progress value={study.relevance * 100} className="mt-1.5 h-1" barClassName={tone.bar} />
          <div
            className={cn(
              "mt-2.5 rounded-md border px-2 py-1 text-center text-[11px] font-medium leading-tight whitespace-nowrap",
              REC_STYLE[rec].cls,
            )}
            title="Derived from the relevance score — advisory only"
          >
            {REC_STYLE[rec].label}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h4 className="text-[14.5px] font-semibold leading-snug text-ink">{study.title}</h4>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
            <span>{study.authors}</span>
            <span>·</span>
            <span className="italic">{study.journal}</span>
            <span>·</span>
            <span>{study.year}</span>
          </div>
          <p className={cn("mt-2 text-[13px] leading-relaxed text-ink-soft", !open && "line-clamp-2")}>{study.abstract}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <DesignChip study={study} value={design} onChange={onDesign} />
            <Badge variant="outline">{study.source}</Badge>
            {decision === "exclude" && logged?.code && (
              <span className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                <CodeBadge code={logged.code} />
                <span className="max-w-[260px] truncate">
                  {logged.code === "Other" && logged.codeNote ? logged.codeNote : codeLabel(logged.code)}
                </span>
                <button
                  type="button"
                  onClick={() => setExcluding(true)}
                  className="cursor-pointer text-[11.5px] font-medium text-brand-700 hover:underline"
                >
                  Edit code
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="ml-1 flex cursor-pointer items-center gap-0.5 text-[12px] text-ink-muted hover:text-brand-700"
            >
              {open ? "Less" : "Full abstract"}
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          </div>

          {(unsupported || design === "Systematic review") && (
            <div
              title={GUIDE_REFS.design}
              className={cn(
                "mt-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] leading-snug",
                unsupported
                  ? "border-flag/35 bg-flag-soft/60 text-[#854408]"
                  : "border-sky-200 bg-sky-50/80 text-sky-900",
              )}
            >
              {unsupported ? (
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
              ) : (
                <Info className="mt-px size-3.5 shrink-0 text-sky-700" />
              )}
              <span>
                {unsupported
                  ? suggestion.code === "S" || !suggestion.code
                    ? "Design not supported in this prototype (RCT-only). Logged as ineligibility code S."
                    : `Design not supported in this prototype (RCT-only). Logged as ineligibility code ${suggestion.code} (${(
                        suggestion.note ?? codeLabel(suggestion.code)
                      ).replace(/^Publication type: /, "publication type: ")}).`
                  : "Included systematic reviews are appraised with AMSTAR 2 and are not extracted or pooled."}
              </span>
            </div>
          )}

          {excluding && (
            <ExclusionPanel
              key={`${design}-${logged?.code ?? ""}`}
              suggestion={suggestion}
              current={decision === "exclude" ? logged : undefined}
              onCancel={() => setExcluding(false)}
              onConfirm={(code, note, wasEdited) => {
                onConfirmExclusion(code, note, wasEdited);
                setExcluding(false);
              }}
            />
          )}

          <RationaleBox
            text={rationale}
            edited={edited}
            logged={!!decision}
            onSave={(t) => onEditRationale(t)}
            onRevert={() => onEditRationale(null)}
          />

          {disagrees && (
            <div className="mt-2 flex animate-fade-in items-center gap-1.5 text-[11.5px] text-[#9a5410]">
              <AlertTriangle className="size-3.5" />
              Your decision differs from the system recommendation
              {!edited && " — consider editing the rationale so the logged reason reflects your judgement."}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <DecisionButton
            active={decision === "include"}
            tone="include"
            onClick={() => {
              setExcluding(false);
              onDecide(decision === "include" ? null : "include");
            }}
          >
            <Check /> Include
          </DecisionButton>
          <DecisionButton
            active={decision === "maybe"}
            tone="maybe"
            onClick={() => {
              setExcluding(false);
              onDecide(decision === "maybe" ? null : "maybe");
            }}
          >
            <CircleHelp /> Maybe
          </DecisionButton>
          <DecisionButton
            active={decision === "exclude"}
            pending={excluding && decision !== "exclude"}
            tone="exclude"
            onClick={onExcludeClick}
          >
            <X /> Exclude
          </DecisionButton>
        </div>
      </div>
    </Card>
  );
}

function RationaleBox({
  text,
  edited,
  logged,
  onSave,
  onRevert,
}: {
  text: string;
  edited: boolean;
  logged: boolean;
  onSave: (t: string) => void;
  onRevert: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const start = () => {
    setDraft(text);
    setEditing(true);
  };

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border px-3.5 py-2.5 transition-colors",
        edited ? "border-flag/35 bg-flag-soft/40" : "border-brand-100 bg-brand-50/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold text-ink-soft">Screening rationale</span>
          {edited ? (
            <Badge variant="amber">
              <UserRound /> Analyst-edited
            </Badge>
          ) : (
            <Badge variant="default">
              <Sparkles /> System-suggested
            </Badge>
          )}
          {logged && <span className="text-[11px] text-ink-muted">· logged as reason</span>}
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            {edited && (
              <button
                type="button"
                onClick={onRevert}
                className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-ink-muted hover:bg-white hover:text-ink"
                title="Restore the system-suggested rationale"
              >
                <RotateCcw className="size-3" /> Revert to suggestion
              </button>
            )}
            <button
              type="button"
              onClick={start}
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium text-brand-700 hover:bg-white"
            >
              <Pencil className="size-3" /> Edit
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                onSave(draft);
                setEditing(false);
              }
            }}
            className="min-h-[64px] bg-white text-[13px]"
          />
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <span className="mr-auto text-[11px] text-ink-muted">Ctrl + Enter to save · Esc to cancel</span>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
            >
              Save rationale
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn("mt-1 text-[13px] leading-relaxed", text ? "text-ink-soft" : "italic text-ink-muted")}>
          {text || "No rationale provided."}
        </p>
      )}
    </div>
  );
}

function DesignChip({
  study,
  value,
  onChange,
}: {
  study: CandidateStudy;
  value: StudyDesign;
  onChange: (d: StudyDesign) => void;
}) {
  const changed = value !== study.design;
  return (
    <label
      title={`${GUIDE_REFS.design}${study.designDetail ? ` · imported as ${study.designDetail}` : ""}${changed ? ` · imported as ${study.design}` : ""}`}
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2 text-[11.5px] font-medium leading-4",
        value === "RCT"
          ? "border-brand-200 bg-brand-50 text-brand-800"
          : value === "Systematic review"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-flag/35 bg-flag-soft text-[#854408]",
      )}
    >
      <span className="text-[10.5px] font-normal opacity-70">Design</span>
      <span>{value === "Other" && study.designDetail && !changed ? `Other · ${study.designDetail}` : value}</span>
      {changed && <UserRound className="size-3" />}
      <ChevronDown className="size-3 opacity-60" />
      <select
        aria-label="Study design"
        value={value}
        onChange={(e) => onChange(e.target.value as StudyDesign)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STUDY_DESIGNS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExclusionPanel({
  suggestion,
  current,
  onCancel,
  onConfirm,
}: {
  suggestion: { code?: IneligibilityCode; note?: string };
  current?: ScreeningDecision;
  onCancel: () => void;
  onConfirm: (code: IneligibilityCode, note: string | undefined, edited: boolean) => void;
}) {
  const [code, setCode] = useState<IneligibilityCode | undefined>(current?.code ?? suggestion.code);
  const [note, setNote] = useState(current?.codeNote ?? suggestion.note ?? "");
  const edited = code !== undefined && (code !== suggestion.code || (code === "Other" && note !== (suggestion.note ?? "")));
  const valid = !!code && (code !== "Other" || note.trim().length > 0);

  return (
    <div className="mt-3 animate-fade-in rounded-lg border border-coral/30 bg-coral-soft/30 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-semibold text-ink-soft">Ineligibility code</span>
        <CodeChips value={code} onChange={setCode} />
        {code &&
          (edited ? (
            <Badge variant="amber">
              <UserRound /> Analyst-edited
            </Badge>
          ) : (
            <Badge variant="default">
              <Sparkles /> System-suggested
            </Badge>
          ))}
        <GuideRef className="ml-auto">{GUIDE_REFS.codes}</GuideRef>
      </div>
      <div className="mt-1.5 text-[11.5px] text-ink-muted">
        {code ? codeLabel(code) : "No matching exclusion criterion. Select the code that applies."}
      </div>
      {code === "Other" && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short reason, e.g. publication type"
          className="mt-2 h-8 bg-white text-[12.5px]"
        />
      )}
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="xs"
          disabled={!valid}
          onClick={() => code && onConfirm(code, code === "Other" ? note.trim() : undefined, edited)}
          className="bg-coral hover:bg-coral/90"
        >
          <X /> Confirm exclusion
        </Button>
      </div>
    </div>
  );
}

function DecisionButton({
  active,
  pending,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  pending?: boolean;
  tone: "include" | "maybe" | "exclude";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls = {
    include: "bg-brand-600 text-white border-brand-600",
    maybe: "bg-[#b45309] text-white border-[#b45309]",
    exclude: "bg-coral text-white border-coral",
  }[tone];
  const idleCls = {
    include: "hover:border-brand-400 hover:text-brand-700",
    maybe: "hover:border-[#b45309] hover:text-[#854408]",
    exclude: "hover:border-coral hover:text-[#991b1b]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-[92px] shrink-0 whitespace-nowrap cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-all active:scale-95 [&_svg]:size-3.5",
        active
          ? activeCls
          : pending
            ? "border-dashed border-coral bg-coral-soft/50 text-[#991b1b]"
            : cn("border-line bg-white text-ink-soft", idleCls),
      )}
    >
      {children}
    </button>
  );
}

function PrismaPanel({
  prisma,
  activeCode,
  onCode,
}: {
  prisma: PrismaCounts;
  activeCode: IneligibilityCode | null;
  onCode: (c: IneligibilityCode) => void;
}) {
  const { identified, duplicates, screened, excluded, included, maybe, undecided } = prisma;
  const decided = included + excluded;
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden shadow-xs">
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-cream/60 px-4 py-2.5">
        <div className="text-[13.5px] font-semibold text-ink">PRISMA 2020 flow (simplified)</div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
          </span>
          <span className="text-[10.5px] font-medium text-brand-700">Live</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 scrollbar-thin">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-2xs divide-y divide-line">
          <FlowRow label="Records identified" value={identified} />
          <FlowRow label="Duplicates removed" value={duplicates} />
        </div>

        <div className="rounded-lg border border-line bg-white shadow-2xs">
          <FlowRow label="Records screened" value={screened} />
        </div>

        <div className="rounded-lg border border-coral/30 bg-coral-soft/50 shadow-2xs">
          <FlowRow label="Records excluded" value={excluded} className="font-semibold text-[#991b1b]" valueClassName="font-bold" />
          <div className="-mt-1 px-3 pb-2">
            <div className="flex flex-wrap gap-1">
              {INELIGIBILITY_CODES.map(({ code, label }) => {
                const n = prisma.byCode[code];
                const on = activeCode === code;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={n === 0}
                    onClick={() => onCode(code)}
                    title={`${label}: ${n} excluded · click to filter the list`}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 font-mono text-[10.5px] leading-[18px] transition-colors disabled:cursor-default disabled:opacity-45",
                      on
                        ? "border-coral bg-coral text-white"
                        : "border-coral/25 bg-white/80 text-ink-soft hover:border-coral/60",
                    )}
                  >
                    <span className="font-semibold">{code}</span>
                    <span className={cn("tabular font-sans font-semibold", on ? "text-white" : "text-[#991b1b]")}>{n}</span>
                  </button>
                );
              })}
            </div>
            <GuideRef className="mt-1" title={GUIDE_REFS.prisma}>
              Reasons per PRISMA flow · Guide p. 21
            </GuideRef>
          </div>
        </div>

        <div className="rounded-lg border-2 border-brand-500 bg-brand-50/90 shadow-xs">
          <FlowRow
            label="Studies included"
            value={included}
            className="font-semibold text-brand-800"
            valueClassName="text-[22px] font-extrabold text-brand-700"
          />
          {maybe > 0 && (
            <div className="px-3 pb-2">
              <span className="inline-flex rounded border border-flag/30 bg-flag-soft/60 px-1.5 py-0.5 text-[11px] font-medium text-[#854408]">
                {maybe} marked “Maybe” · flagged for full-text
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-cream/40 px-4 py-2.5">
        <div className="mb-1 flex justify-between text-[11.5px] text-ink-muted">
          <span>Screening progress</span>
          <span className="tabular font-semibold text-ink-soft">
            {decided}/{screened} ({Math.round((decided / screened) * 100)}%)
          </span>
        </div>
        <Progress value={(decided / screened) * 100} className="h-1.5" />
        <div
          className="mt-1 truncate text-[10.5px] tabular text-ink-muted"
          title="Excluded + Included + Maybe + Undecided = Screened"
        >
          {excluded} excl. + {included} incl. + {maybe} maybe + {undecided} undecided = {screened} screened
        </div>
      </div>
    </Card>
  );
}

function FlowRow({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: number;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex h-10 items-center justify-between gap-2 px-3">
      <span className={cn("truncate text-[13px] font-medium text-ink", className)}>{label}</span>
      <span className={cn("shrink-0 text-[18px] font-bold leading-none tabular", className, valueClassName)}>
        <AnimatedNumber value={value} />
      </span>
    </div>
  );
}

