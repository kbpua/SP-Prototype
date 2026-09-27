import { useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CheckCircle2, Clock, FileCheck2, FileSearch, Plus, ScanText, UserRound, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader } from "@/components/PageHeader";
import { STAGES } from "@/components/layout/stages";
import { useReview } from "@/state/ReviewContext";
import {
  ACTIVE_REVIEW_ID,
  CANDIDATE_STUDIES,
  DASHBOARD_STATS,
  OTHER_REVIEWS,
  THROUGHPUT,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { label: "Screening", who: "AI-ranked, human decides" },
  { label: "Appraisal", who: "Human only", human: true },
  { label: "Extraction", who: "Layout-aware NER" },
  { label: "Verification", who: "Human only", human: true },
  { label: "Synthesis", who: "Random-effects MA" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { stageProgress, screening, extractable, verification, config } = useReview();

  const current = STAGES.find((s) => stageProgress[s.key] < 100) ?? STAGES[STAGES.length - 1];
  const overall = Math.round(Object.values(stageProgress).reduce((a, b) => a + b, 0) / STAGES.length);
  const screenedNow = Object.values(screening).filter((d) => d.decision !== "maybe").length;
  const verifiedNow = extractable.reduce(
    (acc, c) => acc + Object.values(verification[c.id] ?? {}).filter((f) => f && f.status !== "pending").length,
    0,
  );

  const stats = [
    { label: "Studies screened", value: DASHBOARD_STATS.screened + screenedNow, icon: FileSearch },
    { label: "Studies extracted", value: DASHBOARD_STATS.extracted + extractable.length, icon: ScanText },
    { label: "Fields human-verified", value: DASHBOARD_STATS.fieldsVerified + verifiedNow, icon: FileCheck2 },
    { label: "Reviews completed", value: DASHBOARD_STATS.completed, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <PageHeader
        title="Reviews in progress"
        description="Systematic reviews supporting HTAC recommendations. Each review moves through screening, human appraisal, automated extraction with human verification, and synthesis."
        actions={
          <Button size="lg" onClick={() => navigate("/review/config")}>
            <Plus />
            New review
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <div className="flex items-center justify-between text-[12.5px] text-ink-muted">
              {s.label}
              <s.icon className="size-4 text-brand-600" />
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-tight text-ink">
              <AnimatedNumber value={s.value} duration={1100} />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-5">
        <Card className="col-span-2 overflow-hidden border-brand-200">
          <div className="flex items-start justify-between gap-6 bg-gradient-to-br from-brand-50/80 to-white px-6 pt-6 pb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="solid">Active</Badge>
                <span className="font-mono text-[12px] text-ink-muted">{ACTIVE_REVIEW_ID}</span>
              </div>
              <h3 className="mt-2.5 text-[19px] font-semibold leading-snug text-ink">{config.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Updated just now
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> 2 analysts · 1 adjudicator
                </span>
                <span>{CANDIDATE_STUDIES.length} records identified</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[34px] font-semibold leading-none tracking-tight text-brand-700">
                <AnimatedNumber value={overall} />%
              </div>
              <div className="mt-1 text-[12px] text-ink-muted">complete</div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-6 gap-1.5">
              {STAGES.map((s) => (
                <div key={s.key}>
                  <Progress value={stageProgress[s.key]} className="h-1.5" />
                  <div
                    className={cn(
                      "mt-2 text-[11.5px]",
                      s.key === current.key ? "font-semibold text-brand-800" : "text-ink-muted",
                    )}
                  >
                    {s.short}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="text-[13px] text-ink-soft">
                Current stage: <span className="font-medium text-ink">{current.label}</span>
              </div>
              <Button onClick={() => navigate(current.path)}>
                Continue review
                <ArrowRight />
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline design</CardTitle>
            <CardDescription>Human-in-the-loop checkpoints are enforced between automated stages.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {PIPELINE.map((p, i) => (
                <li key={p.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[12px] font-semibold",
                      p.human ? "bg-flag-soft text-[#9a5410]" : "bg-brand-50 text-brand-700",
                    )}
                  >
                    {p.human ? <UserRound className="size-3.5" /> : i + 1}
                  </span>
                  <div className="flex-1 text-[13.5px] font-medium text-ink">{p.label}</div>
                  <span className={cn("text-[12px]", p.human ? "text-[#9a5410]" : "text-ink-muted")}>{p.who}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-5">
        {OTHER_REVIEWS.map((r) => (
          <Card key={r.id} className="flex flex-col p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11.5px] text-ink-muted">{r.id}</span>
              <Badge variant={r.stage === "Completed" ? "solid" : r.stage === "Appraisal" ? "amber" : "default"}>
                {r.stage}
              </Badge>
            </div>
            <h4 className="mt-2.5 flex-1 text-[14.5px] font-semibold leading-snug text-ink">{r.title}</h4>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[12px] text-ink-muted">
                <span>
                  {r.studies} records · {r.lead}
                </span>
                <span className="tabular font-medium text-ink-soft">{r.percent}%</span>
              </div>
              <Progress value={r.percent} />
              <div className="mt-2.5 text-[11.5px] text-ink-muted">Last updated {r.updated}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Extraction throughput</CardTitle>
            <CardDescription>Studies extracted by the pipeline vs. studies fully human-verified, per week</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-300" /> Extracted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-700" /> Verified
            </span>
          </div>
        </CardHeader>
        <CardContent className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={THROUGHPUT} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gExt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#77c4a8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#77c4a8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eee9dd" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e7e2d6", fontSize: 12.5 }}
                cursor={{ stroke: "#abdcc9" }}
              />
              <Area type="monotone" dataKey="extracted" name="Extracted" stroke="#43ab86" fill="url(#gExt)" strokeWidth={2} />
              <Area type="monotone" dataKey="verified" name="Verified" stroke="#0f6e56" fill="transparent" strokeWidth={2.2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
