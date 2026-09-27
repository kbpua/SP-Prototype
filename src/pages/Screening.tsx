import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
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
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import { useReview, type Decision } from "@/state/ReviewContext";
import {
  CANDIDATE_STUDIES,
  RECOMMENDATION_THRESHOLDS,
  SCREENING_RATIONALES,
  SEARCH_SUMMARY,
  type CandidateStudy,
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
  const { screening, setDecision, rationales, setRationale, included } = useReview();
  const [filter, setFilter] = useState<Filter>("all");

  const rationaleText = (id: string) => rationales[id] ?? SCREENING_RATIONALES[id] ?? "";
  const loggedReason = (text: string) => text.trim() || undefined;

  const confirm = (id: string, d: Decision | null) =>
    setDecision(id, d ? { decision: d, reason: loggedReason(rationaleText(id)) } : null);

  const editRationale = (id: string, text: string | null) => {
    setRationale(id, text === null || text === SCREENING_RATIONALES[id] ? null : text);
    const current = screening[id];
    if (current) {
      const next = text ?? SCREENING_RATIONALES[id] ?? "";
      setDecision(id, { ...current, reason: loggedReason(next) });
    }
  };

  const fillRemaining = () => {
    for (const c of CANDIDATE_STUDIES) {
      const existing = screening[c.id];
      if (!existing || existing.decision === "maybe") confirm(c.id, c.suggested.decision);
    }
  };

  const counts = useMemo(() => {
    const c = { include: 0, exclude: 0, maybe: 0, undecided: 0 };
    for (const s of CANDIDATE_STUDIES) {
      const d = screening[s.id]?.decision;
      if (d) c[d]++;
      else c.undecided++;
    }
    return c;
  }, [screening]);

  const reasons = useMemo(() => {
    const r: Record<string, number> = {};
    for (const d of Object.values(screening)) {
      if (d.decision === "exclude") {
        const k = d.reason ?? "Reason not yet specified";
        r[k] = (r[k] ?? 0) + 1;
      }
    }
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [screening]);

  const list = CANDIDATE_STUDIES.slice()
    .sort((a, b) => b.relevance - a.relevance)
    .filter((s) => {
      const d = screening[s.id]?.decision;
      if (filter === "all") return true;
      if (filter === "undecided") return !d;
      return d === filter;
    });

  const total = CANDIDATE_STUDIES.length;
  const screened = counts.include + counts.exclude;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <PageHeader
        step="Stage 2 of 6"
        title="Title and abstract screening"
        badges={<Badge variant="default"><Sparkles /> AI-ranked · human decides</Badge>}
        description="Candidate records are ranked by embedding similarity to the PICOS question and eligibility criteria. Every include or exclude decision is made by the analyst and logged for the PRISMA flow diagram."
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <Card className="mb-4 flex items-center gap-4 px-4 py-3">
            <Database className="size-4 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[12px] text-ink-soft">{SEARCH_SUMMARY.query}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-muted">
                Searched {SEARCH_SUMMARY.searchedOn} ·{" "}
                {SEARCH_SUMMARY.databases.map((d) => `${d.name} (${d.records})`).join(" · ")}
              </div>
            </div>
          </Card>

          <div className="mb-3 flex items-center justify-between">
            <Segmented<Filter>
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${total}` },
                { value: "undecided", label: `Undecided ${counts.undecided}` },
                { value: "include", label: `Included ${counts.include}` },
                { value: "maybe", label: `Maybe ${counts.maybe}` },
                { value: "exclude", label: `Excluded ${counts.exclude}` },
              ]}
            />
            <span className="text-[12px] text-ink-muted">Sorted by relevance score</span>
          </div>

          <div className="space-y-2.5">
            {list.map((s) => (
              <StudyRow
                key={s.id}
                study={s}
                decision={screening[s.id]?.decision}
                rationale={rationaleText(s.id)}
                edited={s.id in rationales}
                onDecide={(d) => confirm(s.id, d)}
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

        <div className="col-span-4">
          <div className="sticky top-6 space-y-4">
            <PrismaPanel
              total={total}
              screened={screened}
              included={counts.include}
              excluded={counts.exclude}
              maybe={counts.maybe}
              undecided={counts.undecided}
              reasons={reasons}
            />
            <button
              type="button"
              onClick={fillRemaining}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-[12px] text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              <Wand2 className="size-3.5" />
              Demo shortcut: fill remaining with reference decisions
            </button>
          </div>
        </div>
      </div>

      <StageFooter
        note={
          included.length === 0
            ? "Include at least one study to proceed."
            : `${included.length} studies will proceed to critical appraisal.`
        }
      >
        <Button size="lg" disabled={included.length === 0} onClick={() => navigate("/review/appraisal")}>
          Proceed to appraisal
          <ArrowRight />
        </Button>
      </StageFooter>
    </div>
  );
}

function relevanceTone(r: number) {
  if (r >= 0.85) return { bar: "bg-brand-600", text: "text-brand-700" };
  if (r >= 0.65) return { bar: "bg-brand-400", text: "text-brand-600" };
  return { bar: "bg-slate-300", text: "text-ink-muted" };
}

const REC_STYLE: Record<Recommendation, { label: string; cls: string }> = {
  include: { label: "Recommend include", cls: "border-brand-200 bg-brand-50 text-brand-800" },
  review: { label: "Recommend review", cls: "border-flag/30 bg-flag-soft text-[#9a5410]" },
  exclude: { label: "Recommend exclude", cls: "border-coral/30 bg-coral-soft text-[#a33a2f]" },
};

function StudyRow({
  study,
  decision,
  rationale,
  edited,
  onDecide,
  onEditRationale,
}: {
  study: CandidateStudy;
  decision?: Decision;
  rationale: string;
  edited: boolean;
  onDecide: (d: Decision | null) => void;
  onEditRationale: (text: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = relevanceTone(study.relevance);
  const rec = recommendationFor(study.relevance);
  const disagrees = (rec === "include" && decision === "exclude") || (rec === "exclude" && decision === "include");

  return (
    <Card
      className={cn(
        "relative overflow-hidden px-5 py-4 transition-all duration-300",
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
      <div className="flex gap-5">
        <div className="w-[104px] shrink-0 pt-0.5">
          <div className={cn("text-[20px] font-semibold leading-none tabular", tone.text)}>
            {Math.round(study.relevance * 100)}
          </div>
          <div className="mt-1 text-[10.5px] text-ink-muted">relevance</div>
          <Progress value={study.relevance * 100} className="mt-1.5 h-1" barClassName={tone.bar} />
          <div
            className={cn(
              "mt-2.5 rounded-md border px-1.5 py-1 text-center text-[11px] font-medium leading-tight",
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
            <Badge variant={study.design === "RCT" ? "default" : "neutral"}>{study.design}</Badge>
            <Badge variant="outline">{study.source}</Badge>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="ml-1 flex cursor-pointer items-center gap-0.5 text-[12px] text-ink-muted hover:text-brand-700"
            >
              {open ? "Less" : "Full abstract"}
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          </div>

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
              Your decision differs from the AI recommendation
              {!edited && " — consider editing the rationale so the logged reason reflects your judgement."}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <DecisionButton
            active={decision === "include"}
            tone="include"
            onClick={() => onDecide(decision === "include" ? null : "include")}
          >
            <Check /> Include
          </DecisionButton>
          <DecisionButton
            active={decision === "maybe"}
            tone="maybe"
            onClick={() => onDecide(decision === "maybe" ? null : "maybe")}
          >
            <CircleHelp /> Maybe
          </DecisionButton>
          <DecisionButton
            active={decision === "exclude"}
            tone="exclude"
            onClick={() => onDecide(decision === "exclude" ? null : "exclude")}
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
              <UserRound /> Reviewer-edited
            </Badge>
          ) : (
            <Badge variant="default">
              <Sparkles /> AI-proposed
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
                title="Restore the AI-proposed rationale"
              >
                <RotateCcw className="size-3" /> Revert to AI
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

function DecisionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "include" | "maybe" | "exclude";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls = {
    include: "bg-brand-600 text-white border-brand-600",
    maybe: "bg-flag text-white border-flag",
    exclude: "bg-coral text-white border-coral",
  }[tone];
  const idleCls = {
    include: "hover:border-brand-400 hover:text-brand-700",
    maybe: "hover:border-flag hover:text-[#9a5410]",
    exclude: "hover:border-coral hover:text-coral",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-[92px] cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-all active:scale-95 [&_svg]:size-3.5",
        active ? activeCls : cn("border-line bg-white text-ink-soft", idleCls),
      )}
    >
      {children}
    </button>
  );
}

function PrismaPanel({
  total,
  screened,
  included,
  excluded,
  maybe,
  undecided,
  reasons,
}: {
  total: number;
  screened: number;
  included: number;
  excluded: number;
  maybe: number;
  undecided: number;
  reasons: [string, number][];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-cream/60 px-5 py-3">
        <div>
          <div className="text-[14px] font-semibold text-ink">PRISMA 2020 flow</div>
          <div className="text-[11.5px] text-ink-muted">Updates live with each decision</div>
        </div>
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand-500" />
        </span>
      </div>

      <div className="space-y-1 p-5">
        <FlowBox phase="Identification" label="Records identified" value={total} sub="4 databases incl. HERDIN" />
        <Arrow />
        <div className="grid grid-cols-[1fr_auto] items-stretch gap-2">
          <FlowBox phase="Screening" label="Records screened" value={screened} sub={`of ${total} · ${undecided + maybe} awaiting`} />
          <div className="flex items-center text-line">
            <ArrowRight className="size-4 text-ink-muted/50" />
          </div>
        </div>
        <div className="ml-6 rounded-lg border border-coral/25 bg-coral-soft/50 px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-[#a33a2f]">Records excluded</span>
            <span className="text-[20px] font-semibold text-[#a33a2f]">
              <AnimatedNumber value={excluded} />
            </span>
          </div>
          {reasons.length > 0 && (
            <ul className="mt-2 max-h-[240px] space-y-1.5 overflow-y-auto border-t border-coral/15 pt-2 pr-1 scrollbar-thin">
              {reasons.map(([r, n]) => (
                <li key={r} className="flex animate-fade-in items-start justify-between gap-2 text-[11.5px] leading-snug text-ink-soft">
                  <span
                    title={r}
                    className={cn("line-clamp-2", r.startsWith("Reason not") && "italic text-[#9a5410]")}
                  >
                    {r}
                  </span>
                  <span className="tabular font-medium">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Arrow />
        <div className="rounded-lg border-2 border-brand-500 bg-brand-50 px-4 py-3.5">
          <div className="text-[10.5px] font-medium tracking-wide text-brand-700">Included</div>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-brand-900">Studies included in review</span>
            <span className="text-[30px] font-semibold leading-none text-brand-700">
              <AnimatedNumber value={included} />
            </span>
          </div>
        </div>
        {maybe > 0 && (
          <div className="pt-2 text-center text-[11.5px] text-[#9a5410]">
            {maybe} marked “maybe” — flagged for full-text review
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 py-3.5">
        <div className="mb-1.5 flex justify-between text-[12px] text-ink-muted">
          <span>Screening progress</span>
          <span className="tabular font-medium text-ink-soft">
            {screened}/{total}
          </span>
        </div>
        <Progress value={(screened / total) * 100} />
      </div>
    </Card>
  );
}

function FlowBox({ phase, label, value, sub }: { phase: string; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-[10.5px] font-medium tracking-wide text-ink-muted">{phase}</div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-[22px] font-semibold text-ink">
          <AnimatedNumber value={value} />
        </span>
      </div>
      <div className="text-[11.5px] text-ink-muted">{sub}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center py-0.5">
      <ArrowDown className="size-4 text-ink-muted/50" />
    </div>
  );
}
