import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  EyeOff,
  Info,
  Lock,
  Pencil,
  RotateCcw,
  Scale,
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
import { AgreementCard, DualStatusLine, canResolve } from "@/components/dualReview";
import { PROTOTYPE_CONFIG } from "@/config/prototypeConfig";
import {
  RESOLVER_ROLE,
  ROLE_LABELS,
  SCREENABLE_STUDIES,
  dualStatus,
  screeningAgree,
  screeningConflictKind,
  suggestedExclusion,
  useReview,
  type Decision,
  type DualRecord,
  type DualStatus,
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

type Filter = "all" | "undecided" | "include" | "maybe" | "exclude" | "conflicts";
type Recommendation = "include" | "review" | "exclude";

function recommendationFor(score: number): Recommendation {
  if (score >= RECOMMENDATION_THRESHOLDS.include) return "include";
  if (score >= RECOMMENDATION_THRESHOLDS.review) return "review";
  return "exclude";
}

const DECISION_LABEL: Record<Decision, string> = { include: "Include", maybe: "Maybe", exclude: "Exclude" };

function describeDecision(d: ScreeningDecision) {
  if (d.decision !== "exclude") return DECISION_LABEL[d.decision];
  return `Exclude · ${d.code ?? "Other"}`;
}

export default function Screening() {
  const navigate = useNavigate();
  const {
    role,
    screening,
    screeningDual,
    setDecision,
    resolveScreening,
    rationales,
    setRationale,
    designOf,
    setDesign,
    applySuggestedDecisions,
    prisma,
    screeningAgreement,
  } = useReview();
  const [filter, setFilter] = useState<Filter>("all");
  const [codeFilter, setCodeFilter] = useState<IneligibilityCode | null>(null);

  const reviewer = role === "adjudicator" ? null : role;
  const resolverHere = canResolve(role);
  const rationaleText = (id: string) => rationales[id] ?? SCREENING_RATIONALES[id] ?? "";

  /** Decision shown in the list: the reviewer's own commit, or the final decision for the adjudicator. */
  const viewDecision = (id: string): ScreeningDecision | undefined =>
    reviewer ? screeningDual[id]?.[reviewer] : screening[id];
  const statusOf = (id: string): DualStatus => dualStatus(screeningDual[id], screeningAgree);

  const commit = (id: string, d: ScreeningDecision | null) => setDecision(id, d);

  const buildExclusion = (
    study: CandidateStudy,
    code: IneligibilityCode,
    note: string | undefined,
    edited: boolean,
  ): ScreeningDecision => ({
    decision: "exclude",
    reason: edited ? codeLabel(code) : (study.suggested.reason ?? codeLabel(code)),
    code,
    codeNote: code === "Other" ? note : undefined,
    codeEdited: edited,
  });

  const editRationale = (id: string, text: string | null) => {
    setRationale(id, text === null || text === SCREENING_RATIONALES[id] ? null : text);
  };

  const openConflicts = SCREENABLE_STUDIES.filter((s) => statusOf(s.id) === "conflict").length;
  const awaiting = SCREENABLE_STUDIES.filter((s) => statusOf(s.id) === "partial").length;

  const viewCounts = { include: 0, exclude: 0, maybe: 0, undecided: 0 };
  for (const s of SCREENABLE_STUDIES) {
    const d = viewDecision(s.id);
    if (!d) viewCounts.undecided++;
    else viewCounts[d.decision]++;
  }

  const list = SCREENABLE_STUDIES.slice()
    .sort((a, b) => b.relevance - a.relevance)
    .filter((s) => {
      const d = viewDecision(s.id);
      if (filter === "all") return true;
      if (filter === "conflicts") return statusOf(s.id) === "conflict";
      if (filter === "undecided") return !d;
      if (filter === "exclude" && codeFilter) {
        const f = screening[s.id];
        return f?.decision === "exclude" && (f.code ?? "Other") === codeFilter;
      }
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

  // Gate: every record has a final (agreed or resolved) decision AND at least one is Included
  const canProceed = prisma.undecided === 0 && prisma.included > 0;

  const handleProceed = () => {
    if (!canProceed) return;
    if (prisma.maybe > 0) {
      const proceed = window.confirm(
        `${prisma.maybe} ${prisma.maybe === 1 ? "study is" : "studies are"} marked Maybe. Resolve them, or continue with Included studies only?`,
      );
      if (!proceed) return;
    }
    navigate("/review/appraisal");
  };

  const footerNote = useMemo(() => {
    if (openConflicts > 0) {
      return `${openConflicts} conflict${openConflicts === 1 ? "" : "s"} awaiting ${ROLE_LABELS[RESOLVER_ROLE].toLowerCase()} resolution.`;
    }
    if (prisma.undecided > 0) {
      return `${prisma.undecided} record${prisma.undecided === 1 ? "" : "s"} still need${prisma.undecided === 1 ? "s" : ""} decisions from both reviewers${awaiting ? ` (${awaiting} awaiting a second reviewer)` : ""}.`;
    }
    if (prisma.included === 0) {
      return "Include at least one study to proceed.";
    }
    if (prisma.maybe > 0) {
      return `${prisma.included} studies included (${prisma.maybe} marked Maybe). Only Included studies carry forward.`;
    }
    return `${prisma.included} ${prisma.included === 1 ? "study" : "studies"} will proceed to critical appraisal.`;
  }, [openConflicts, awaiting, prisma]);

  const mine = reviewer ? "My " : "";

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
                <AboutAutomation text="Records are ranked by embedding similarity to the PICO question. The system suggests a decision, an ineligibility code, and a rationale; two reviewers decide independently and conflicts are resolved by an adjudicator." />
              </div>
            }
            description="Candidate records are ranked by embedding similarity to the PICO question and eligibility criteria. Two reviewers screen each record independently; agreed or resolved decisions feed the PRISMA flow diagram."
          />

          <div className="mb-2 flex min-w-0 items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[12px] leading-snug text-sky-900">
            <Info className="mt-px size-3.5 shrink-0 text-sky-700" />
            <span>
              Scope: randomised controlled trials of drugs and vaccines for therapeutic-effect questions (Guide Table 2, p. 18). Other designs are logged as code S.
            </span>
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
                  { value: "undecided", label: `${reviewer ? "To do" : "Undecided"} ${viewCounts.undecided}` },
                  { value: "include", label: `${mine}Included ${viewCounts.include}` },
                  { value: "maybe", label: `Maybe ${viewCounts.maybe}` },
                  { value: "exclude", label: `Excluded ${viewCounts.exclude}` },
                  { value: "conflicts", label: `Conflicts ${openConflicts}` },
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
              <span className="text-[11.5px] text-ink-muted whitespace-nowrap">
                Viewing as {ROLE_LABELS[role]} · sorted by relevance
              </span>
            )}
          </div>

          <div className="space-y-2.5 pb-8 lg:pb-2">
            {list.map((s) => (
              <StudyRow
                key={s.id}
                study={s}
                rec={screeningDual[s.id]}
                status={statusOf(s.id)}
                decision={viewDecision(s.id)}
                reviewerMode={!!reviewer}
                resolverHere={resolverHere}
                design={designOf(s)}
                onDesign={(d) => setDesign(s.id, d)}
                rationale={rationaleText(s.id)}
                edited={s.id in rationales}
                onCommit={(d) => commit(s.id, d)}
                onResolve={(d) => resolveScreening(s.id, d)}
                buildExclusion={(code, note, edited) => buildExclusion(s, code, note, edited)}
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
            <PrismaPanel prisma={prisma} conflicts={openConflicts} activeCode={codeFilter} onCode={filterByCode} />

            <AgreementCard stage="screening" stats={screeningAgreement} />

            {/* Dynamic CTA Block below PRISMA flow */}
            <div className="shrink-0 space-y-2 rounded-xl border border-line bg-white p-3 shadow-2xs">
              <Button
                size="lg"
                className="w-full justify-center shadow-xs"
                disabled={!canProceed}
                onClick={handleProceed}
                title={canProceed ? undefined : footerNote}
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
                title="Demo shortcut: fills both reviewers' remaining decisions with reference decisions, including a few disagreements to resolve"
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
  rec,
  status,
  decision: logged,
  reviewerMode,
  resolverHere,
  design,
  onDesign,
  rationale,
  edited,
  onCommit,
  onResolve,
  buildExclusion,
  onEditRationale,
}: {
  study: CandidateStudy;
  rec?: DualRecord<ScreeningDecision>;
  status: DualStatus;
  decision?: ScreeningDecision;
  reviewerMode: boolean;
  resolverHere: boolean;
  design: StudyDesign;
  onDesign: (d: StudyDesign) => void;
  rationale: string;
  edited: boolean;
  onCommit: (d: ScreeningDecision | null) => void;
  onResolve: (d: ScreeningDecision) => void;
  buildExclusion: (code: IneligibilityCode, note: string | undefined, edited: boolean) => ScreeningDecision;
  onEditRationale: (text: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const resolving = resolverHere && (status === "conflict" || status === "resolved");
  const shown = resolving ? rec?.resolved : logged;
  const decision = shown?.decision;
  const committedBoth = !!(rec?.A && rec?.B);
  const locked = resolving ? false : !reviewerMode || committedBoth;
  const hidden = PROTOTYPE_CONFIG.hideSuggestionsUntilCommit && reviewerMode && !logged;
  const tone = relevanceTone(study.relevance);
  const rec_ = recommendationFor(study.relevance);
  const disagrees =
    !hidden && ((rec_ === "include" && decision === "exclude") || (rec_ === "exclude" && decision === "include"));
  const suggestion = suggestedExclusion(study, design);
  const unsupported = !isSupportedDesign(design);
  const conflictKind = screeningConflictKind(rec);

  const act = (d: ScreeningDecision | null) => {
    if (resolving) {
      if (d) onResolve(d);
    } else if (!locked) onCommit(d);
  };

  const lockTitle = !reviewerMode
    ? `${ROLE_LABELS[RESOLVER_ROLE]} decides only on conflicts`
    : "Both reviewers have committed; conflicts go to resolution";

  const onExcludeClick = () => {
    if (excluding) setExcluding(false);
    else if (decision === "exclude" && !resolving) act(null);
    else setExcluding(true);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden px-5 py-4 transition-all duration-200 hover:border-brand-200/80",
        decision === "include" && "border-brand-300 bg-brand-50/40",
        decision === "exclude" && "bg-cream/70 opacity-75 hover:opacity-100",
        decision === "maybe" && "border-flag/40",
        status === "conflict" && "border-coral/40 opacity-100",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-colors duration-300",
          status === "conflict"
            ? "bg-coral"
            : decision === "include"
              ? "bg-brand-500"
              : decision === "exclude"
                ? "bg-coral/60"
                : decision === "maybe"
                  ? "bg-flag"
                  : "bg-transparent",
        )}
      />
      <div className="flex gap-4 sm:gap-5">
        <div className="w-32 min-w-[128px] shrink-0 pt-0.5">
          {hidden ? (
            <div className="rounded-md border border-dashed border-line px-2 py-2 text-center text-[11px] leading-snug text-ink-muted">
              <EyeOff className="mx-auto mb-1 size-3.5" />
              Score and recommendation hidden until you commit
            </div>
          ) : (
            <>
              <div className={cn("text-[20px] font-semibold leading-none tabular", tone.text)}>
                {Math.round(study.relevance * 100)}
              </div>
              <div className="mt-1 text-[10.5px] text-ink-muted">relevance</div>
              <Progress value={study.relevance * 100} className="mt-1.5 h-1" barClassName={tone.bar} />
              <div
                className={cn(
                  "mt-2.5 rounded-md border px-2 py-1 text-center text-[11px] font-medium leading-tight whitespace-nowrap",
                  REC_STYLE[rec_].cls,
                )}
                title="Derived from the relevance score — advisory only"
              >
                {REC_STYLE[rec_].label}
              </div>
            </>
          )}
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
            {decision === "exclude" && shown?.code && (
              <span className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                <CodeBadge code={shown.code} />
                <span className="max-w-[260px] truncate">
                  {shown.code === "Other" && shown.codeNote ? shown.codeNote : codeLabel(shown.code)}
                </span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => setExcluding(true)}
                    className="cursor-pointer text-[11.5px] font-medium text-brand-700 hover:underline"
                  >
                    Edit code
                  </button>
                )}
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

          {(rec?.A || rec?.B) && (
            <div
              className={cn(
                "mt-2.5 rounded-md border px-2.5 py-1.5",
                status === "conflict" ? "border-coral/35 bg-coral-soft/30" : "border-line bg-cream/50",
              )}
            >
              <DualStatusLine rec={rec} status={status} describe={describeDecision} codeMismatch={conflictKind === "code"} />
              {resolving && status === "conflict" && rec?.A && rec?.B && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  <span className="flex items-center gap-1 font-medium text-[#991b1b]">
                    <Scale className="size-3.5" />
                    {conflictKind === "code" ? "Resolve code mismatch:" : "Resolve conflict:"}
                  </span>
                  <Button size="xs" variant="outline" onClick={() => onResolve(stripStamp(rec.A!))}>
                    Use Reviewer A · {describeDecision(rec.A)}
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => onResolve(stripStamp(rec.B!))}>
                    Use Reviewer B · {describeDecision(rec.B)}
                  </Button>
                  <span className="text-ink-muted">or decide with the buttons</span>
                </div>
              )}
            </div>
          )}

          {excluding && (
            <ExclusionPanel
              key={`${design}-${shown?.code ?? ""}`}
              suggestion={hidden ? {} : suggestion}
              current={decision === "exclude" ? shown : undefined}
              onCancel={() => setExcluding(false)}
              onConfirm={(code, note, wasEdited) => {
                act(buildExclusion(code, note, wasEdited));
                setExcluding(false);
              }}
            />
          )}

          <RationaleBox
            text={rationale}
            edited={edited}
            hidden={hidden && !edited}
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
          {resolving && (
            <span className="text-center text-[10.5px] font-medium text-[#991b1b]">Final decision</span>
          )}
          <DecisionButton
            active={decision === "include"}
            disabled={locked}
            title={locked ? lockTitle : undefined}
            tone="include"
            onClick={() => {
              setExcluding(false);
              act(decision === "include" && !resolving ? null : { decision: "include" });
            }}
          >
            <Check /> Include
          </DecisionButton>
          <DecisionButton
            active={decision === "maybe"}
            disabled={locked}
            title={locked ? lockTitle : undefined}
            tone="maybe"
            onClick={() => {
              setExcluding(false);
              act(decision === "maybe" && !resolving ? null : { decision: "maybe" });
            }}
          >
            <CircleHelp /> Maybe
          </DecisionButton>
          <DecisionButton
            active={decision === "exclude"}
            disabled={locked}
            title={locked ? lockTitle : undefined}
            pending={excluding && decision !== "exclude"}
            tone="exclude"
            onClick={onExcludeClick}
          >
            <X /> Exclude
          </DecisionButton>
          {locked && reviewerMode && (
            <span className="flex items-center justify-center gap-1 text-[10.5px] text-ink-muted" title={lockTitle}>
              <Lock className="size-3" /> Committed
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function stripStamp(d: ScreeningDecision & { at?: string }): ScreeningDecision {
  const { decision, reason, code, codeNote, codeEdited } = d;
  return { decision, reason, code, codeNote, codeEdited };
}

function RationaleBox({
  text,
  edited,
  hidden,
  logged,
  onSave,
  onRevert,
}: {
  text: string;
  edited: boolean;
  hidden?: boolean;
  logged: boolean;
  onSave: (t: string) => void;
  onRevert: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const start = () => {
    setDraft(hidden ? "" : text);
    setEditing(true);
  };

  if (hidden && !editing) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-line px-3.5 py-2 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <EyeOff className="size-3.5 shrink-0" /> System-suggested rationale hidden until you commit
        </span>
        <button
          type="button"
          onClick={start}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium text-brand-700 hover:bg-cream"
        >
          <Pencil className="size-3" /> Write rationale
        </button>
      </div>
    );
  }

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
          {logged && <span className="text-[11px] text-ink-muted">Â· logged as reason</span>}
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
            <span className="mr-auto text-[11px] text-ink-muted">Ctrl + Enter to save Â· Esc to cancel</span>
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
      title={`${GUIDE_REFS.design}${study.designDetail ? ` Â· imported as ${study.designDetail}` : ""}${changed ? ` Â· imported as ${study.design}` : ""}`}
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2 text-[11.5px] font-medium leading-4",
        value === "RCT"
          ? "border-brand-200 bg-brand-50 text-brand-800"
          : isSupportedDesign(value)
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-flag/35 bg-flag-soft text-[#854408]",
      )}
    >
      <span className="text-[10.5px] font-normal opacity-70">Design</span>
      <span>{value === "Other" && study.designDetail && !changed ? `Other Â· ${study.designDetail}` : value}</span>
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
  disabled,
  title,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
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
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-[92px] shrink-0 whitespace-nowrap cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:size-3.5",
        disabled && !active && "opacity-45",
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
  conflicts,
  activeCode,
  onCode,
}: {
  prisma: PrismaCounts;
  conflicts: number;
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
                    title={`${label}: ${n} excluded Â· click to filter the list`}
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
              Reasons per PRISMA flow Â· Guide p. 21
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
                {maybe} marked â€œMaybeâ€ Â· flagged for full-text
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
          title={`Excluded + Included + Maybe + Undecided = Screened. Undecided counts records without an agreed or resolved decision${conflicts ? ` (${conflicts} in conflict)` : ""}.`}
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

