import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Info, Sigma } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import { useReview } from "@/state/ReviewContext";
import { dersimonianLaird, formatP, type EffectMeasure, type PooledResult, type StudyInput } from "@/lib/meta";
import { buildStudyInputs, finalValues, robOverall } from "@/lib/review";

const MEASURE_NAMES: Record<EffectMeasure, string> = {
  RR: "Risk ratio",
  OR: "Odds ratio",
  HR: "Hazard ratio",
  MD: "Mean difference",
};

export default function Synthesis() {
  const navigate = useNavigate();
  const { extractable, verification, appraisal, config, markVisited } = useReview();
  const [measure, setMeasure] = useState<EffectMeasure>(config.effectMeasure === "MD" ? "RR" : config.effectMeasure);
  const [excludeHighRob, setExcludeHighRob] = useState(false);

  useEffect(() => markVisited("synthesis"), [markVisited]);

  const { inputs, skipped } = useMemo(() => buildStudyInputs(extractable, verification), [extractable, verification]);
  const highRobIds = new Set(extractable.filter((s) => robOverall(appraisal[s.id]).label === "High risk").map((s) => s.id));
  const analysed = excludeHighRob ? inputs.filter((i) => !highRobIds.has(i.id)) : inputs;
  const result = useMemo(() => dersimonianLaird(measure, analysed), [measure, analysed]);

  const pendingDocs = extractable.filter((s) =>
    Object.values(verification[s.id] ?? {}).filter((v) => v && v.status !== "pending").length === 0,
  );

  return (
    <div className="mx-auto max-w-[1320px] px-8 py-8">
      <PageHeader
        step="Stage 5 of 6"
        title="Evidence synthesis"
        badges={
          <Badge variant="default">
            <Sigma /> Automated from verified data
          </Badge>
        }
        description="Human-verified outcome data are pooled using a random-effects meta-analysis. Corrections made during verification flow directly into these estimates."
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
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-flag/30 bg-flag-soft/60 px-4 py-3 text-[13px] text-[#8a5a2b]">
          <AlertTriangle className="size-4 shrink-0" />
          {pendingDocs.length} document(s) have not been verified yet — their unverified extractions are shown for
          preview only.
        </div>
      )}

      {result ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card className="col-span-2 border-brand-200 bg-gradient-to-br from-brand-50/70 to-white px-6 py-5">
              <div className="text-[12.5px] font-medium text-brand-800">
                Pooled {MEASURE_NAMES[measure].toLowerCase()} · random effects
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-[40px] font-semibold leading-none tracking-tight text-brand-700">
                  <AnimatedNumber value={result.est} digits={2} />
                </span>
                <span className="text-[16px] tabular text-ink-soft">
                  95% CI {result.lo.toFixed(2)} to {result.hi.toFixed(2)}
                </span>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                Across {result.studies.length} trials, dapagliflozin was associated with a{" "}
                <b className="text-ink">{Math.round((1 - result.est) * 100)}% relative reduction</b> in the primary
                composite outcome versus control (z = {result.z.toFixed(2)}, p {formatP(result.p).startsWith("<") ? "" : "= "}
                {formatP(result.p)}).
              </p>
            </Card>

            <Card className="col-span-2 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-medium text-ink-soft">Heterogeneity</div>
                <Badge variant={result.i2 < 30 ? "default" : result.i2 < 60 ? "amber" : "coral"}>
                  {result.i2 < 30 ? "Low" : result.i2 < 60 ? "Moderate" : "Substantial"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <Stat label="I²" value={`${result.i2.toFixed(1)}%`} />
                <Stat label="τ²" value={result.tau2.toFixed(4)} />
                <Stat label={`Q (df = ${result.df})`} value={result.q.toFixed(2)} sub={`p = ${formatP(result.pQ)}`} />
              </div>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Forest plot — primary composite outcome</CardTitle>
                <CardDescription>
                  Cardiovascular death or worsening heart failure · dapagliflozin vs control
                </CardDescription>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-soft">
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
            <CardContent>
              <ForestPlot result={result} inputs={analysed} measure={measure} />
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
                <th className="py-2 font-medium">Risk of bias</th>
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
                      <Badge variant={rob.tone}>{rob.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <StageFooter note="Results are recalculated whenever verified values change.">
        <Button size="lg" onClick={() => navigate("/review/export")}>
          Export results
          <ArrowRight />
        </Button>
      </StageFooter>
    </div>
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full font-sans" role="img" aria-label="Forest plot">
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

      {/* Null line */}
      <line x1={x(1)} x2={x(1)} y1={HEAD} y2={axisY} stroke="#94a3b8" strokeWidth={1.2} />
      {/* Pooled estimate reference */}
      <line
        x1={x(result.est)}
        x2={x(result.est)}
        y1={HEAD}
        y2={axisY}
        stroke="#1d9e75"
        strokeWidth={1}
        strokeDasharray="3 4"
        style={{ transition: ease }}
      />

      {result.studies.map((s, i) => {
        const y = HEAD + i * ROW + ROW / 2;
        const raw = byId.get(s.id);
        const size = 7 + 13 * Math.sqrt(s.weight / maxW);
        const xl = Math.max(COL.plotL, x(s.lo));
        const xr = Math.min(COL.plotR, x(s.hi));
        return (
          <g key={s.id} className="animate-fade-in" style={{ animationDelay: `${i * 70}ms` }}>
            {i % 2 === 0 && <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill="#faf8f3" />}
            <text x={COL.study} y={y + 4.5} fontSize={14} fontWeight={600} fill="#1e293b">
              {s.label}
              <tspan fontWeight={400} fill="#64748b"> {s.year}</tspan>
            </text>
            <text x={COL.treat + 60} y={y + 4.5} fontSize={13.5} textAnchor="middle" fill="#475569" className="tabular">
              {raw ? `${raw.eT} / ${raw.nT}` : "—"}
            </text>
            <text x={COL.ctrl + 60} y={y + 4.5} fontSize={13.5} textAnchor="middle" fill="#475569" className="tabular">
              {raw ? `${raw.eC} / ${raw.nC}` : "—"}
            </text>
            <rect
              x={xl}
              y={y - 0.9}
              width={Math.max(0, xr - xl)}
              height={1.8}
              fill="#334155"
              style={{ x: xl, width: Math.max(0, xr - xl), transition: ease } as React.CSSProperties}
            />
            <rect
              x={x(s.est) - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              fill="#0f6e56"
              style={{ x: x(s.est) - size / 2, y: y - size / 2, width: size, height: size, transition: ease } as React.CSSProperties}
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
      <text x={COL.study} y={axisY + 19} fontSize={12} fill="#64748b">
        Heterogeneity: I² = {result.i2.toFixed(0)}%, τ² = {result.tau2.toFixed(4)}, Q = {result.q.toFixed(2)} (df ={" "}
        {result.df}), p = {formatP(result.pQ)}
      </text>
      <text x={COL.study} y={axisY + 38} fontSize={12} fill="#64748b">
        Test for overall effect: z = {result.z.toFixed(2)}, p {formatP(result.p).startsWith("<") ? "" : "= "}
        {formatP(result.p)}
      </text>
      <text x={COL.treat + 60} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="middle" fill="#1e293b" className="tabular">
        {sum(inputs, "eT")} / {sum(inputs, "nT")}
      </text>
      <text x={COL.ctrl + 60} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="middle" fill="#1e293b" className="tabular">
        {sum(inputs, "eC")} / {sum(inputs, "nC")}
      </text>
      <polygon
        key={`${measure}-${result.est.toFixed(4)}`}
        className="animate-fade-in"
        points={`${x(result.lo)},${pooledY} ${x(result.est)},${pooledY - 10} ${x(result.hi)},${pooledY} ${x(result.est)},${pooledY + 10}`}
        fill="#1d9e75"
        stroke="#0c5643"
        strokeWidth={1.2}
      />
      <text x={COL.est} y={pooledY + 4.5} fontSize={14} fontWeight={700} fill="#0c5643" className="tabular">
        {result.est.toFixed(2)} [{result.lo.toFixed(2)}, {result.hi.toFixed(2)}]
      </text>
      <text x={COL.weight} y={pooledY + 4.5} fontSize={13.5} fontWeight={600} textAnchor="end" fill="#1e293b">
        100%
      </text>

      {/* Axis */}
      <line x1={COL.plotL} x2={COL.plotR} y1={axisY} y2={axisY} stroke="#334155" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={axisY} y2={axisY + 5} stroke="#334155" />
          <text x={x(t)} y={axisY + 19} fontSize={12} textAnchor="middle" fill="#475569">
            {t}
          </text>
        </g>
      ))}
      <text x={x(1) - 10} y={axisY + 42} fontSize={12.5} textAnchor="end" fill="#0f6e56" fontWeight={500}>
        ← Favours dapagliflozin
      </text>
      <text x={x(1) + 10} y={axisY + 42} fontSize={12.5} fill="#a33a2f" fontWeight={500}>
        Favours control →
      </text>
    </svg>
  );
}

function sum(inputs: StudyInput[], k: "eT" | "nT" | "eC" | "nC") {
  return inputs.reduce((a, i) => a + i[k], 0).toLocaleString();
}