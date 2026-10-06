import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronDown, Info, Sparkles, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageContainer, PageHeader, StageFooter } from "@/components/PageHeader";
import { GUIDE_REFS, GuideRef } from "@/components/guide";
import { RobDots, RobTrafficLight } from "@/components/RobTrafficLight";
import { activeFieldIds, useReview, type GradeCertainty, type GradeLevel } from "@/state/ReviewContext";
import { ROB2_DOMAINS } from "@/data/mockData";
import { dersimonianLaird, formatP, type EffectMeasure, type PooledResult, type StudyInput } from "@/lib/meta";
import {
  GRADE_DOMAINS,
  GRADE_LEVEL_LABELS,
  amstarOverall,
  buildStudyInputs,
  finalValues,
  gradeSuggestions,
  reviewsOnlyNote,
  robOverall,
} from "@/lib/review";
import { cn } from "@/lib/utils";

const MEASURE_NAMES: Record<EffectMeasure, string> = {
  RR: "Risk ratio",
  OR: "Odds ratio",
  HR: "Hazard ratio",
  MD: "Mean difference",
};

const CERTAINTY: { value: GradeCertainty; label: string }[] = [
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
  { value: "very-low", label: "Very low" },
];

type ConformanceStatus = "Met" | "Partly" | "Not assessed" | "Out of scope";

const STATUS_VARIANT: Record<ConformanceStatus, "default" | "amber" | "slate" | "outline"> = {
  Met: "default",
  Partly: "amber",
  "Not assessed": "slate",
  "Out of scope": "outline",
};

export default function Synthesis() {
  const navigate = useNavigate();
  const {
    extractable,
    reviewsOnly,
    verification,
    appraisal,
    config,
    grade,
    setGrade,
    prisma,
    markVisited,
  } = useReview();
  const [measure, setMeasure] = useState<EffectMeasure>(config.effectMeasure === "MD" ? "RR" : config.effectMeasure);
  const [excludeHighRob, setExcludeHighRob] = useState(false);
  const [conformanceOpen, setConformanceOpen] = useState(true);

  useEffect(() => markVisited("synthesis"), [markVisited]);

  const { inputs, skipped } = useMemo(() => buildStudyInputs(extractable, verification), [extractable, verification]);
  const highRobIds = new Set(extractable.filter((s) => robOverall(appraisal[s.id]).label === "High risk").map((s) => s.id));
  const analysed = excludeHighRob ? inputs.filter((i) => !highRobIds.has(i.id)) : inputs;
  const result = useMemo(() => dersimonianLaird(measure, analysed), [measure, analysed]);
  const k = result?.studies.length ?? 0;
  const single = k === 1;

  const activeIds = activeFieldIds(config.schemas);
  const pendingDocs = extractable.filter((s) =>
    Object.values(verification[s.id] ?? {}).filter((v) => v && v.status !== "pending").length === 0,
  );
  const anyUnverified = extractable.some((s) =>
    [...activeIds].some((id) => (verification[s.id]?.[id]?.status ?? "pending") === "pending"),
  );
  const appraisalIncomplete = extractable.some((s) => robOverall(appraisal[s.id]).label === "Not assessed");

  const robLabels = analysed.map((i) => robOverall(appraisal[i.id]).label);
  const suggested = gradeSuggestions(result, robLabels);
  const robSummary = robLabels.length ? robLabels.join(", ") : "—";

  const gradeNotes: Record<string, string> = {
    rob: robLabels.includes("Not assessed") ? "Complete appraisal to prefill" : `From appraisal: ${robSummary}`,
    consistency: !result ? "—" : single ? "I² not estimable (k = 1)" : `I² = ${result.i2.toFixed(0)}%`,
    precision: !result
      ? "—"
      : `95% CI ${result.lo.toFixed(2)}–${result.hi.toFixed(2)} ${result.lo < 1 && result.hi > 1 ? "crosses" : "excludes"} 1`,
    directness: "Analyst-entered",
    reporting: "Analyst-entered",
  };

  const gradeEntered = Object.keys(grade.domains).length > 0 || !!grade.overall;
  const conformance: { item: string; status: ConformanceStatus; note: string }[] = [
    {
      item: "Outcomes to be pooled",
      status: result ? "Met" : "Not assessed",
      note: result ? "Primary composite outcome" : "No outcome data available for pooling",
    },
    { item: "Pooling model (random or fixed effects)", status: "Met", note: "Random effects, DerSimonian–Laird" },
    {
      item: "Test for heterogeneity (Q, I²)",
      status: !result ? "Not assessed" : single ? "Partly" : "Met",
      note: !result ? "No pooled result" : single ? "Computed; not estimable at k = 1" : `Q and I² computed across k = ${k}`,
    },
    {
      item: "Method of exploring heterogeneity",
      status: "Partly",
      note: "Sensitivity analysis available; subgroup and meta-regression out of scope",
    },
    {
      item: "Publication bias (funnel plot / Deeks' test)",
      status: k >= 10 ? "Out of scope" : "Not assessed",
      note: k >= 10 ? "Funnel plot not implemented in this prototype" : "Needs more studies (typically about 10 or more)",
    },
    {
      item: "Quality of evidence (GRADE)",
      status: grade.overall ? "Met" : gradeEntered ? "Partly" : "Not assessed",
      note: grade.overall
        ? `Analyst-entered: ${CERTAINTY.find((c) => c.value === grade.overall)?.label} certainty`
        : "Required by the Guide; analyst-entered here (see GRADE card)",
    },
    {
      item: "Reporting format (PRISMA flow)",
      status: prisma.undecided === 0 ? "Met" : "Partly",
      note: prisma.undecided === 0 ? "See Screening panel" : `Screening in progress (${prisma.undecided} undecided)`,
    },
  ];
  const conformanceTally = (["Met", "Partly", "Not assessed", "Out of scope"] as ConformanceStatus[])
    .map((s) => [s, conformance.filter((c) => c.status === s).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <PageContainer>
      <PageHeader
        step="Stage 5 of 6"
        title="Evidence synthesis"
        description="Verified outcome data pooled with a random-effects meta-analysis."
        actions={
          <Segmented<EffectMeasure>
            value={measure}
            onChange={setMeasure}
            options={[
              { value: "RR", label: "RR" },
              { value: "OR", label: "OR" },
              { value: "HR", label: "HR" },
              { value: "MD", label: "MD", disabled: true, title: "Not applicable: dichotomous outcome" },
            ]}
          />
        }
      />

      {pendingDocs.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-flag/30 bg-flag-soft/60 px-4 py-3 text-[13px] text-[#8a5a2b]">
          <AlertTriangle className="size-4 shrink-0" />
          {pendingDocs.length} document(s) have not been verified yet — their unverified extractions are shown for
          preview only.
        </div>
      )}
      {reviewsOnly.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-2 text-[12.5px] text-sky-900">
          <Info className="size-4 shrink-0 text-sky-700" />
          {reviewsOnlyNote(reviewsOnly.length)}
        </div>
      )}

      {result ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="col-span-1 lg:col-span-2 border-brand-200 bg-brand-50/40 px-5 sm:px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12.5px] font-medium text-brand-800">
                  Pooled {MEASURE_NAMES[measure].toLowerCase()} · random effects
                </div>
                {anyUnverified && (
                  <Badge variant="amber" title="Some extracted fields have not been verified yet">
                    <AlertTriangle /> Preview: includes unverified values
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="text-[36px] sm:text-[40px] font-semibold leading-none tracking-tight text-brand-700">
                  <AnimatedNumber value={result.est} digits={2} />
                </span>
                <span className="text-[15px] sm:text-[16px] tabular text-ink-soft whitespace-nowrap">
                  95% CI {result.lo.toFixed(2)} to {result.hi.toFixed(2)}
                </span>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                {single ? "From a single trial" : `Across ${k} trials`}, dapagliflozin was associated with a{" "}
                <b className="text-ink">{Math.round((1 - result.est) * 100)}% relative reduction</b> in the primary
                composite outcome versus control (z = {result.z.toFixed(2)}, p {formatP(result.p).startsWith("<") ? "" : "= "}
                {formatP(result.p)}).
              </p>
            </Card>

            <Card className="col-span-1 lg:col-span-2 px-5 sm:px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-medium text-ink-soft">Heterogeneity</div>
                {single ? (
                  <Badge variant="slate">Not estimable (k = 1)</Badge>
                ) : (
                  <Badge variant={result.i2 < 30 ? "default" : result.i2 < 60 ? "amber" : "coral"}>
                    {result.i2 < 30 ? "Low" : result.i2 < 60 ? "Moderate" : "Substantial"}
                  </Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <Stat label="I²" value={single ? "—" : `${result.i2.toFixed(1)}%`} />
                <Stat label="τ²" value={single ? "—" : result.tau2.toFixed(4)} />
                <Stat
                  label={single ? "Q" : `Q (df = ${result.df})`}
                  value={single ? "—" : result.q.toFixed(2)}
                  sub={single ? "Q df = 0" : `p = ${formatP(result.pQ)}`}
                />
              </div>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Forest plot — primary composite outcome</CardTitle>
                <CardDescription>
                  Cardiovascular death or worsening heart failure · dapagliflozin vs control
                </CardDescription>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-soft whitespace-nowrap">
                <input
                  type="checkbox"
                  className="size-4 accent-[#0f6e56]"
                  checked={excludeHighRob}
                  onChange={(e) => setExcludeHighRob(e.target.checked)}
                />
                Sensitivity: exclude high risk-of-bias trials
                {highRobIds.size > 0 && <Badge variant="coral">{highRobIds.size}</Badge>}
              </label>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[640px]">
                <ForestPlot result={result} inputs={analysed} measure={measure} />
              </div>
              {single && (
                <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                  <Info className="size-3.5 shrink-0" />
                  Single study: the pooled estimate equals the study estimate.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="py-16 text-center text-[13px] text-ink-muted">
          No studies with complete outcome data are available for pooling.
        </Card>
      )}

      {skipped.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Info className="size-4" />
          Excluded from pooling: {skipped.map((s) => `${s.study.trial?.acronym} (${s.reason.toLowerCase()})`).join("; ")}
        </div>
      )}

      <RobTrafficLight
        className="mt-5"
        studies={extractable}
        appraisal={appraisal}
        title="Risk of bias across included trials"
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>Cochrane RoB 2 domains (D1–D5) and overall, read from the appraisal stage</span>
            <GuideRef>{GUIDE_REFS.appraisal}</GuideRef>
          </span>
        }
        footer={
          appraisalIncomplete && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[12.5px] text-ink-muted">
              <span>Dashed cells are domains not yet assessed.</span>
              <button
                type="button"
                onClick={() => navigate("/review/appraisal")}
                className="cursor-pointer font-medium text-brand-700 hover:underline"
              >
                Complete appraisal →
              </button>
            </div>
          )
        }
      />

      {reviewsOnly.length > 0 && (
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle>Systematic reviews appraised (AMSTAR 2) — not pooled</CardTitle>
            <CardDescription>Appraised only; RCT-only scope for extraction and pooling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reviewsOnly.map((s) => {
              const o = amstarOverall(appraisal[s.id]);
              return (
                <div key={s.id} className="flex items-center justify-between gap-4 rounded-lg border border-line px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{s.title}</div>
                    <div className="text-[12px] text-ink-muted">
                      {s.authors.split(",")[0]} · {s.journal} · {s.year}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[12px] text-ink-muted">
                    Overall confidence
                    <Badge variant={o.tone}>{o.label}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Verified extraction summary</CardTitle>
          <CardDescription>Final values after human verification, with risk-of-bias judgements from appraisal</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-muted">
                <th className="py-2 pr-3 font-medium">Study</th>
                <th className="py-2 pr-3 font-medium">Setting</th>
                <th className="py-2 pr-3 text-right font-medium">Randomised</th>
                <th className="py-2 pr-3 text-right font-medium">Events / N (dapagliflozin)</th>
                <th className="py-2 pr-3 text-right font-medium">Events / N (control)</th>
                <th className="py-2 pr-3 font-medium">Reported HR (95% CI)</th>
                <th className="py-2 pr-3 font-medium">Follow-up</th>
                <th className="py-2 font-medium" title={ROB2_DOMAINS.map((d) => d.title).join("\n")}>
                  Risk of bias (D1–D5)
                </th>
              </tr>
            </thead>
            <tbody>
              {extractable.map((s) => {
                const v = finalValues(s, verification);
                const rob = robOverall(appraisal[s.id]);
                const corrected = Object.values(verification[s.id] ?? {}).filter((x) => x?.status === "corrected").length;
                return (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-ink">
                        {s.trial?.acronym} <span className="font-normal text-ink-muted">{s.year}</span>
                      </div>
                      {corrected > 0 && <div className="text-[11px] text-sky-700">{corrected} field(s) corrected</div>}
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 pr-3 text-ink-soft" title={v.country ?? ""}>
                      {v.country ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular">{v.randomized ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular">
                      {v.eT ?? "—"} / {v.nT ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular">
                      {v.eC ?? "—"} / {v.nC ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular">{v.hr ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-ink-soft">{v.followUp ?? "—"}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <RobDots assessment={appraisal[s.id]} />
                        {rob.label === "Not assessed" ? (
                          <button
                            type="button"
                            onClick={() => navigate("/review/appraisal")}
                            className="cursor-pointer text-[12px] font-medium text-brand-700 hover:underline"
                          >
                            Complete appraisal →
                          </button>
                        ) : (
                          <span className="text-[12px] text-ink-soft">{rob.label}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Quality of evidence (GRADE)</CardTitle>
            <CardDescription>Primary composite outcome · cardiovascular death or worsening heart failure</CardDescription>
          </div>
          <GuideRef>{GUIDE_REFS.grade}</GuideRef>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-line rounded-lg border border-line">
            {GRADE_DOMAINS.map((d) => {
              const set = grade.domains[d.id];
              const value = set ?? suggested[d.id];
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5">
                  <span className="w-32 shrink-0 text-[13px] font-medium text-ink">{d.label}</span>
                  <select
                    aria-label={`GRADE ${d.label}`}
                    value={value ?? ""}
                    onChange={(e) =>
                      setGrade({ domains: { ...grade.domains, [d.id]: e.target.value as GradeLevel } })
                    }
                    className="h-8 cursor-pointer rounded-md border border-line bg-white px-2 text-[12.5px] text-ink focus:border-brand-400 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {(Object.keys(GRADE_LEVEL_LABELS) as GradeLevel[]).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {GRADE_LEVEL_LABELS[lvl]}
                      </option>
                    ))}
                  </select>
                  {set ? (
                    <Badge variant="amber">
                      <UserRound /> Analyst-edited
                    </Badge>
                  ) : value ? (
                    <Badge variant="default">
                      <Sparkles /> System-suggested
                    </Badge>
                  ) : (
                    <Badge variant="slate">Analyst-entered</Badge>
                  )}
                  <span className="min-w-0 flex-1 truncate text-right text-[12px] text-ink-muted">{gradeNotes[d.id]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cream px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-ink-soft">Overall certainty</span>
              <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
                {CERTAINTY.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setGrade({ overall: grade.overall === c.value ? undefined : c.value })}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1 text-[12.5px] font-medium transition-all",
                      grade.overall === c.value ? "bg-brand-700 text-white shadow-sm" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[12px] text-ink-muted">System suggests, analyst decides.</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <button
          type="button"
          onClick={() => setConformanceOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left"
          aria-expanded={conformanceOpen}
        >
          <div>
            <div className="text-[15px] font-semibold text-ink">Methods Guide conformance (Table 4)</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {conformanceTally.map(([s, n]) => (
                <Badge key={s} variant={STATUS_VARIANT[s]}>
                  {n} {s}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-muted transition-transform", conformanceOpen && "rotate-180")} />
        </button>
        {conformanceOpen && (
          <CardContent className="animate-fade-in pt-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Table 4 item</th>
                  <th className="w-32 py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {conformance.map((c) => (
                  <tr key={c.item} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">{c.item}</td>
                    <td className="py-2.5 pr-3">
                      <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="py-2.5 text-ink-soft">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <GuideRef title={GUIDE_REFS.conformance}>Guide reference: Table 4, pp. 20–21</GuideRef>
            </div>
          </CardContent>
        )}
      </Card>

      <StageFooter pinned note="Results are recalculated whenever verified values change.">
        <Button onClick={() => navigate("/review/export")}>
          Export results
          <ArrowRight />
        </Button>
      </StageFooter>
    </PageContainer>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-ink-muted">{label}</div>
      <div className="text-[22px] font-semibold tabular text-ink">{value}</div>
      {sub && <div className="text-[11.5px] tabular text-ink-muted">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forest plot (SVG, log scale)
// ---------------------------------------------------------------------------

const W = 1180;
const ROW = 38;
const HEAD = 44;
const COL = { study: 16, treat: 250, ctrl: 380, plotL: 500, plotR: 860, est: 900, weight: 1164 };
const CANDIDATE_TICKS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3];

function ForestPlot({ result, inputs, measure }: { result: PooledResult; inputs: StudyInput[]; measure: EffectMeasure }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lo = Math.min(0.5, ...result.studies.map((s) => s.lo)) * 0.95;
  const hi = Math.max(1.5, ...result.studies.map((s) => s.hi)) * 1.05;
  const x = (v: number) =>
    COL.plotL + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (COL.plotR - COL.plotL);
  const ticks = CANDIDATE_TICKS.filter((t) => t >= lo && t <= hi);
  const n = result.studies.length;
  const pooledY = HEAD + n * ROW + 26;
  const axisY = pooledY + 30;
  const H = axisY + 58;
  const maxW = Math.max(...result.studies.map((s) => s.weight));
  const byId = new Map(inputs.map((i) => [i.id, i]));
  const ease = "all 700ms cubic-bezier(0.2, 0.7, 0.2, 1)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none font-sans" role="img" aria-label="Forest plot">
      {/* Header */}
      <g fill="#64748b" fontSize={13} fontWeight={500}>
        <text x={COL.study} y={24}>Study</text>
        <text x={COL.treat + 60} y={16} textAnchor="middle">Dapagliflozin</text>
        <text x={COL.treat + 60} y={32} textAnchor="middle" fontSize={11.5}>events / total</text>
        <text x={COL.ctrl + 60} y={16} textAnchor="middle">Control</text>
        <text x={COL.ctrl + 60} y={32} textAnchor="middle" fontSize={11.5}>events / total</text>
        <text x={(COL.plotL + COL.plotR) / 2} y={24} textAnchor="middle">
          {measure} (95% CI)
        </text>
        <text x={COL.est} y={24}>{measure} [95% CI]</text>
        <text x={COL.weight} y={24} textAnchor="end">Weight</text>
      </g>
      <line x1={0} x2={W} y1={HEAD - 4} y2={HEAD - 4} stroke="#e7e2d6" />

      {/* Subtle tick gridlines behind the plot */}
      {ticks.map((t) => (
        <line
          key={`grid-${t}`}
          x1={x(t)}
          x2={x(t)}
          y1={HEAD}
          y2={axisY}
          stroke="#e7e2d6"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.8}
        />
      ))}

      {/* Null line */}
      <line x1={x(1)} x2={x(1)} y1={HEAD} y2={axisY} stroke="#64748b" strokeWidth={1.4} />

      {/* Pooled estimate reference */}
      <line
        x1={x(result.est)}
        x2={x(result.est)}
        y1={HEAD}
        y2={axisY}
        stroke="#1d9e75"
        strokeWidth={1.2}
        strokeDasharray="3 4"
        style={{ transition: ease }}
      />

      {result.studies.map((s, i) => {
        const y = HEAD + i * ROW + ROW / 2;
        const raw = byId.get(s.id);
        const size = 7 + 13 * Math.sqrt(s.weight / maxW);
        const xl = Math.max(COL.plotL, x(s.lo));
        const xr = Math.min(COL.plotR, x(s.hi));
        const isHovered = hoveredId === s.id;
        return (
          <g
            key={s.id}
            className="cursor-pointer transition-colors duration-150"
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <rect
              x={0}
              y={y - ROW / 2}
              width={W}
              height={ROW}
              fill={isHovered ? "#f2eee4" : i % 2 === 0 ? "#faf8f3" : "transparent"}
              className="transition-colors duration-150"
            />
            <text x={COL.study} y={y + 4.5} fontSize={14} fontWeight={600} fill={isHovered ? "#0f6e56" : "#1e293b"}>
              {s.label}
              <tspan fontWeight={400} fill="#64748b"> {s.year}</tspan>
            </text>
            <text x={COL.treat + 60} y={y + 4.5} fontSize={13.5} textAnchor="middle" fill="#475569" className="tabular">
              {raw ? `${raw.eT} / ${raw.nT}` : "—"}
            </text>
            <text x={COL.ctrl + 60} y={y + 4.5} fontSize={13.5} textAnchor="middle" fill="#475569" className="tabular">
              {raw ? `${raw.eC} / ${raw.nC}` : "—"}
            </text>
            {/* CI Whisker Ends */}
            <line x1={xl} x2={xl} y1={y - 3.5} y2={y + 3.5} stroke="#334155" strokeWidth={1.5} />
            <line x1={xr} x2={xr} y1={y - 3.5} y2={y + 3.5} stroke="#334155" strokeWidth={1.5} />
            {/* CI line */}
            <line
              x1={xl}
              x2={xr}
              y1={y}
              y2={y}
              stroke="#334155"
              strokeWidth={1.8}
              style={{ transition: ease }}
            />
            {/* Study Marker Square */}
            <rect
              x={x(s.est) - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rx={1}
              fill="#0f6e56"
              stroke="#093f31"
              strokeWidth={0.8}
              style={{ transition: ease }}
            />
            <text x={COL.est} y={y + 4.5} fontSize={13.5} fill="#1e293b" className="tabular">
              {s.est.toFixed(2)} [{s.lo.toFixed(2)}, {s.hi.toFixed(2)}]
            </text>
            <text x={COL.weight} y={y + 4.5} fontSize={13.5} textAnchor="end" fill="#475569" className="tabular">
              {s.weight.toFixed(1)}%
            </text>
          </g>
        );
      })}

      {/* Pooled */}
      <line x1={0} x2={W} y1={pooledY - 20} y2={pooledY - 20} stroke="#e7e2d6" />
      <text x={COL.study} y={pooledY - 1} fontSize={14} fontWeight={700} fill="#0c5643">
        Random-effects model
      </text>
      <text x={COL.study} y={pooledY + 14} fontSize={11.5} fill="#64748b">
        DerSimonian–Laird
      </text>
      <text x={COL.study} y={axisY + 19} fontSize={12} fill="#64748b" className="tabular">
        {n < 2
          ? "Heterogeneity: not estimable (k = 1; Q df = 0)"
          : `Heterogeneity: I² = ${result.i2.toFixed(0)}%, τ² = ${result.tau2.toFixed(4)}, Q = ${result.q.toFixed(2)} (df = ${result.df}), p = ${formatP(result.pQ)}`}
      </text>
      <text x={COL.study} y={axisY + 38} fontSize={12} fill="#64748b" className="tabular">
        Test for overall effect: z = {result.z.toFixed(2)}, p {formatP(result.p).startsWith("<") ? "" : "= "}
        {formatP(result.p)}
      </text>
      <text x={COL.treat + 60} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="middle" fill="#1e293b" className="tabular">
        {sum(inputs, "eT")} / {sum(inputs, "nT")}
      </text>
      <text x={COL.ctrl + 60} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="middle" fill="#1e293b" className="tabular">
        {sum(inputs, "eC")} / {sum(inputs, "nC")}
      </text>
      {/* Pooled Diamond */}
      <polygon
        key={`${measure}-${result.est.toFixed(4)}`}
        className="animate-fade-in"
        points={`${x(result.lo)},${pooledY} ${x(result.est)},${pooledY - 12} ${x(result.hi)},${pooledY} ${x(result.est)},${pooledY + 12}`}
        fill="#1d9e75"
        stroke="#093f31"
        strokeWidth={1.6}
      />
      <text x={COL.est} y={pooledY + 4.5} fontSize={14} fontWeight={700} fill="#0c5643" className="tabular">
        {result.est.toFixed(2)} [{result.lo.toFixed(2)}, {result.hi.toFixed(2)}]
      </text>
      <text x={COL.weight} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="end" fill="#1e293b" className="tabular">
        100%
      </text>

      {/* Axis */}
      <line x1={COL.plotL} x2={COL.plotR} y1={axisY} y2={axisY} stroke="#334155" strokeWidth={1.2} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={axisY} y2={axisY + 5} stroke="#334155" strokeWidth={1.2} />
          <text x={x(t)} y={axisY + 19} fontSize={12} textAnchor="middle" fill="#475569" className="tabular">
            {t}
          </text>
        </g>
      ))}
      <text x={x(1) - 10} y={axisY + 42} fontSize={12.5} textAnchor="end" fill="#0f6e56" fontWeight={500}>
        ← Favours dapagliflozin
      </text>
      <text x={x(1) + 10} y={axisY + 42} fontSize={12.5} fill="#991b1b" fontWeight={500}>
        Favours control →
      </text>
    </svg>
  );
}

function sum(inputs: StudyInput[], k: "eT" | "nT" | "eC" | "nC") {
  return inputs.reduce((a, i) => a + i[k], 0).toLocaleString();
}