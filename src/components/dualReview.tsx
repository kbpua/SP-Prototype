import type { ReactNode } from "react";
import { AlertTriangle, CheckCheck, Clock, EyeOff, Scale, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GUIDE_REFS, GuideRef } from "@/components/guide";
import {
  RESOLVER_ROLE,
  ROLE_LABELS,
  useReview,
  type AgreementStats,
  type DualRecord,
  type DualStatus,
  type ReviewerId,
  type Role,
} from "@/state/ReviewContext";
import { KAPPA_MIN_N } from "@/lib/agreement";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["A", "B", "adjudicator"];

export const LIMITATION_NOTE = "Third-reviewer escalation and appraisal-stage dual review are not implemented.";

export function otherReviewer(r: ReviewerId): ReviewerId {
  return r === "A" ? "B" : "A";
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Header control for switching the simulated reviewer role. */
export function RoleSwitcher() {
  const { role, setRole, roleNoteDismissed, dismissRoleNote } = useReview();
  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <Users className="hidden size-3.5 text-ink-muted lg:block" />
      <div
        role="radiogroup"
        aria-label="Reviewer role"
        className="inline-flex rounded-lg border border-line bg-cream p-0.5"
        title="Reviewer roles apply to screening and extraction"
      >
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-all",
              role === r ? "bg-white text-brand-800 shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      {!roleNoteDismissed && (
        <div className="absolute top-full right-0 z-40 mt-1.5 flex w-72 animate-fade-in items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[11.5px] leading-snug text-ink-soft shadow-lg">
          <span className="flex-1">Reviewer roles are simulated in this prototype. It is not a multi-user system.</span>
          <button
            type="button"
            onClick={dismissRoleNote}
            aria-label="Dismiss note"
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-ink-muted hover:bg-cream hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<DualStatus, { label: string; variant: "default" | "amber" | "coral" | "slate" | "outline" }> = {
  open: { label: "Not committed", variant: "slate" },
  partial: { label: "Awaiting second reviewer", variant: "outline" },
  agreed: { label: "Agreed", variant: "default" },
  conflict: { label: "Conflict", variant: "coral" },
  resolved: { label: "Resolved", variant: "default" },
};

export function DualStatusBadge({ status, codeMismatch }: { status: DualStatus; codeMismatch?: boolean }) {
  const s = STATUS_BADGE[status];
  return (
    <Badge variant={s.variant}>
      {status === "conflict" && <AlertTriangle />}
      {status === "resolved" && <Scale />}
      {status === "agreed" && <CheckCheck />}
      {status === "conflict" && codeMismatch ? "Code mismatch" : s.label}
    </Badge>
  );
}

/**
 * One line describing both reviewers' commits from the current role's point of view.
 * A reviewer sees the other decision only after both have committed.
 */
export function DualStatusLine<T>({
  rec,
  status,
  describe,
  codeMismatch,
  className,
}: {
  rec: DualRecord<T> | undefined;
  status: DualStatus;
  describe: (v: T) => ReactNode;
  codeMismatch?: boolean;
  className?: string;
}) {
  const { role } = useReview();
  const both = !!(rec?.A && rec?.B);

  const side = (r: ReviewerId) => {
    const v = rec?.[r];
    const mine = role === r;
    let body: ReactNode;
    if (!v) body = <span className="italic text-ink-muted">not committed</span>;
    else if (!both && role !== "adjudicator" && !mine)
      body = (
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <EyeOff className="size-3" /> committed · hidden until you commit
        </span>
      );
    else body = <span className="font-medium text-ink-soft">{describe(v)}</span>;
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className={cn("font-semibold", mine ? "text-brand-700" : "text-ink-muted")}>{ROLE_LABELS[r]}:</span>
        {body}
      </span>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]", className)}>
      {side("A")}
      {side("B")}
      {(both || status === "resolved") && <DualStatusBadge status={status} codeMismatch={codeMismatch} />}
      {rec?.resolved && (
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <Clock className="size-3" />
          {ROLE_LABELS[rec.resolved.resolver]} · {formatTime(rec.resolved.at)} ·{" "}
          <span className="font-medium text-ink-soft">{describe(rec.resolved)}</span>
        </span>
      )}
    </div>
  );
}

export function canResolve(role: Role) {
  return role === RESOLVER_ROLE;
}

function fmtKappa(stats: AgreementStats) {
  if (stats.paired === 0) return "—";
  if (stats.kappa === null) return "not estimable";
  return stats.kappa.toFixed(2);
}

/** Per-stage reviewer-versus-reviewer agreement summary. */
export function AgreementCard({
  stage,
  stats,
  compact,
  className,
}: {
  stage: "screening" | "extraction";
  stats: AgreementStats;
  compact?: boolean;
  className?: string;
}) {
  const kappaTip =
    stage === "screening"
      ? "Cohen's kappa on Include versus Exclude, with Maybe as its own category. Code mismatches agree on the decision and are counted separately."
      : "Cohen's kappa on the reviewers' field decisions (accept / correct / reject / adjudicate) and tag decisions (accept / correct / remove). Differing corrected values count as conflicts.";
  const kappaNote = `Not estimable when fewer than ${KAPPA_MIN_N} items are paired or expected agreement is 1. Distinct from the module-versus-gold-standard kappa.`;
  const unit = stage === "screening" ? "records" : "fields + tags";
  const total = stats.conflicts + stats.codeMismatches;

  if (compact) {
    return (
      <Card className={cn("min-w-0 px-3.5 py-1.5", className)}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-muted">
          <span className="font-semibold text-ink">Reviewer-versus-reviewer agreement</span>
          <span className="tabular">
            <b className="font-semibold text-ink-soft">{stats.paired}/{stats.items}</b> {unit} paired
          </span>
          <span className={cn("tabular", stats.openConflicts > 0 && "text-coral")}>
            <b className="font-semibold">{stats.conflicts}</b> conflicts
            {stats.conflicts > 0 && ` (${stats.resolved} resolved)`}
          </span>
          <span className="tabular" title="Percent agreement on decision categories">
            <b className="font-semibold text-ink-soft">{stats.percent === null ? "—" : `${stats.percent.toFixed(1)}%`}</b> agreement
          </span>
          <span className="cursor-help tabular" title={`${kappaTip} ${kappaNote}`}>
            Cohen's κ <b className="font-semibold text-ink-soft">{fmtKappa(stats)}</b>
          </span>
          <GuideRef className="ml-auto">{GUIDE_REFS.independent}</GuideRef>
        </div>
        <div className="truncate text-[10.5px] text-ink-muted">{LIMITATION_NOTE}</div>
      </Card>
    );
  }

  return (
    <Card className={cn("shrink-0 px-4 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="text-[12.5px] font-semibold text-ink">Reviewer-versus-reviewer agreement</div>
        <GuideRef>{GUIDE_REFS.independent}</GuideRef>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <Metric label={unit} value={`${stats.paired}/${stats.items}`} title="Items both reviewers have committed" />
        <Metric
          label={stage === "screening" ? "conflicts" : "conflicts"}
          value={String(stats.conflicts)}
          sub={stage === "screening" ? `+ ${stats.codeMismatches} code mismatch${stats.codeMismatches === 1 ? "" : "es"}` : undefined}
          tone={stats.openConflicts > 0 ? "coral" : undefined}
        />
        <Metric
          label="agreement"
          value={stats.percent === null ? "—" : `${stats.percent.toFixed(1)}%`}
          title="Percent agreement on decision categories"
        />
        <Metric label="Cohen's κ" value={fmtKappa(stats)} title={`${kappaTip} ${kappaNote}`} />
      </div>
      {total > 0 && (
        <div className="mt-1.5 text-[11px] tabular text-ink-muted">
          {stats.resolved} of {total} resolved by {ROLE_LABELS[RESOLVER_ROLE].toLowerCase()}
          {stats.openConflicts > 0 && ` · ${stats.openConflicts} open`}
        </div>
      )}
      <div className="mt-1.5 text-[11px] leading-snug text-ink-muted">{LIMITATION_NOTE}</div>
    </Card>
  );
}

function Metric({
  label,
  value,
  sub,
  title,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
  tone?: "coral";
}) {
  return (
    <div title={title} className={cn("min-w-0", title && "cursor-help")}>
      <div
        className={cn(
          "truncate text-[16px] font-semibold leading-tight tabular",
          tone === "coral" ? "text-coral" : "text-ink",
          value === "not estimable" && "text-[12px] font-medium text-ink-muted",
        )}
      >
        {value}
      </div>
      <div className="truncate text-[10.5px] text-ink-muted">{label}</div>
      {sub && <div className="truncate text-[10.5px] text-ink-muted">{sub}</div>}
    </div>
  );
}
