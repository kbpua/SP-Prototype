import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Copy, Download, FileJson, FileSpreadsheet, History, LayoutDashboard, PartyPopper } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHeader } from "@/components/PageHeader";
import { activeFieldIds, useReview } from "@/state/ReviewContext";
import { ACTIVE_REVIEW_ID, CANDIDATE_STUDIES, EXTRACTION_FIELDS, getExtractedFields } from "@/data/mockData";
import { dersimonianLaird } from "@/lib/meta";
import { buildStudyInputs, finalValues, robOverall } from "@/lib/review";
import { cn } from "@/lib/utils";

type Format = "json" | "csv" | "audit";

export default function Export() {
  const navigate = useNavigate();
  const { config, screening, included, extractable, verification, appraisal, markVisited } = useReview();
  const [format, setFormat] = useState<Format>("json");
  const [copied, setCopied] = useState(false);

  useEffect(() => markVisited("export"), [markVisited]);

  const activeIds = activeFieldIds(config.schemas);
  const measure = config.effectMeasure === "MD" ? "RR" : config.effectMeasure;
  const { inputs } = buildStudyInputs(extractable, verification);
  const pooled = dersimonianLaird(measure, inputs);

  const excluded = Object.values(screening).filter((d) => d.decision === "exclude").length;
  const screened = Object.values(screening).filter((d) => d.decision !== "maybe").length;
  const fieldsVerified = extractable.reduce(
    (acc, s) => acc + [...activeIds].filter((id) => (verification[s.id]?.[id]?.status ?? "pending") !== "pending").length,
    0,
  );

  const build = (format: Format): string => {
    if (format === "json") {
      const data = {
        review_id: ACTIVE_REVIEW_ID,
        title: config.title,
        framework: "Philippine HTA Methods Guide (DOH-HTAC, RA 11223)",
        exported_at: new Date().toISOString(),
        picos: {
          population: config.population,
          intervention: config.intervention,
          comparator: config.comparator,
          outcome: config.outcome,
          study_design: config.studyDesign,
        },
        prisma: { identified: CANDIDATE_STUDIES.length, screened, excluded, included: included.length },
        studies: extractable.map((s) => {
          const v = finalValues(s, verification);
          return {
            id: s.id,
            acronym: s.trial?.acronym,
            citation: `${s.authors} (${s.year}). ${s.journal}.`,
            risk_of_bias: robOverall(appraisal[s.id]).label,
            fields: Object.fromEntries(
              getExtractedFields(s.trial!)
                .filter((f) => activeIds.has(f.def.id))
                .map((f) => [
                  f.def.id,
                  {
                    value: v[f.def.id],
                    status: verification[s.id]?.[f.def.id]?.status ?? "pending",
                    confidence: f.confidence,
                    source: f.def.source,
                    schema: f.def.schemas.filter((x) => config.schemas[x.key]).map((x) => `${x.key}:${x.item}`),
                  },
                ]),
            ),
          };
        }),
        meta_analysis: pooled && {
          model: "random-effects (DerSimonian–Laird)",
          measure,
          k: pooled.studies.length,
          estimate: +pooled.est.toFixed(3),
          ci_95: [+pooled.lo.toFixed(3), +pooled.hi.toFixed(3)],
          p_value: +pooled.p.toExponential(3),
          heterogeneity: {
            i2: +pooled.i2.toFixed(1),
            tau2: +pooled.tau2.toFixed(4),
            q: +pooled.q.toFixed(2),
            df: pooled.df,
          },
        },
      };
      return JSON.stringify(data, null, 2);
    }
    if (format === "csv") {
      const cols = EXTRACTION_FIELDS.filter((f) => activeIds.has(f.id));
      const esc = (s: string | null | undefined) => {
        const t = s ?? "";
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const header = ["study_id", "acronym", "year", "risk_of_bias", ...cols.map((c) => c.id)].join(",");
      const rows = extractable.map((s) => {
        const v = finalValues(s, verification);
        return [s.id, s.trial?.acronym, String(s.year), robOverall(appraisal[s.id]).label, ...cols.map((c) => v[c.id])]
          .map(esc)
          .join(",");
      });
      return [header, ...rows].join("\n");
    }
    const log = extractable.flatMap((s) =>
      getExtractedFields(s.trial!)
        .filter((f) => verification[s.id]?.[f.def.id] && verification[s.id]?.[f.def.id]?.status !== "pending")
        .map((f) => {
          const ver = verification[s.id]![f.def.id]!;
          return {
            study: s.trial?.acronym,
            field: f.def.id,
            action: ver.status,
            extracted: f.extracted,
            final: ver.status === "corrected" ? ver.value : ver.status === "rejected" ? null : f.extracted,
            model_confidence: f.confidence,
            source: f.def.source,
            reviewer: "HTA Analyst",
          };
        }),
    );
    return JSON.stringify({ review_id: ACTIVE_REVIEW_ID, verification_log: log }, null, 2);
  };

  const content = build(format);

  const download = (fmt: Format) => {
    const blob = new Blob([build(fmt)], { type: fmt === "csv" ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ACTIVE_REVIEW_ID}_${fmt === "audit" ? "audit-trail.json" : fmt === "csv" ? "extraction.csv" : "evidence-synthesis.json"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const funnel = [
    { label: "Identified", value: CANDIDATE_STUDIES.length, sub: "4 databases" },
    { label: "Screened", value: screened, sub: `${excluded} excluded` },
    { label: "Included", value: included.length, sub: "after appraisal" },
    { label: "Extracted", value: extractable.length, sub: `${fieldsVerified} fields verified` },
    { label: "Synthesised", value: pooled?.studies.length ?? 0, sub: pooled ? `${measure} ${pooled.est.toFixed(2)}` : "—" },
  ];

  const corrections = Object.values(verification).reduce(
    (acc, v) => acc + Object.values(v).filter((f) => f?.status === "corrected").length,
    0,
  );

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">
      <PageHeader
        step="Stage 6 of 6"
        title="Export"
        description="Download the structured evidence package for the HTAC technical working group. Every value carries its verification status and source location."
      />

      <Card className="overflow-hidden border-brand-200">
        <div className="flex items-center gap-3 bg-brand-700 px-6 py-4 text-white">
          <PartyPopper className="size-5" />
          <div>
            <div className="text-[15px] font-semibold">Pipeline complete</div>
            <div className="text-[12.5px] text-brand-100">
              From {CANDIDATE_STUDIES.length} records to a pooled estimate — with {corrections} human correction(s) applied
              along the way.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 items-stretch px-4 py-6">
          {funnel.map((f, i) => (
            <div key={f.label} className="relative flex flex-col items-center text-center">
              {i < funnel.length - 1 && (
                <ChevronRight className="absolute top-6 -right-2.5 size-5 text-brand-300" />
              )}
              <div className="text-[12px] font-medium text-ink-muted">{f.label}</div>
              <div className="mt-1 text-[34px] font-semibold leading-none tracking-tight text-brand-700">
                <AnimatedNumber value={f.value} duration={600 + i * 150} />
              </div>
              <div className="mt-1.5 text-[12px] text-ink-soft">{f.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2 flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Segmented<Format>
              size="sm"
              value={format}
              onChange={setFormat}
              options={[
                { value: "json", label: "JSON" },
                { value: "csv", label: "CSV" },
                { value: "audit", label: "Audit trail" },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre
            key={format}
            className="h-[460px] animate-fade-in overflow-auto whitespace-pre-wrap break-words bg-[#10231d] px-5 py-4 font-mono text-[12px] leading-relaxed text-brand-100 scrollbar-thin"
          >
            {format === "csv" ? content : <Highlighted json={content} />}
          </pre>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Downloads</CardTitle>
              <CardDescription>Generated from the current verified state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <DownloadRow
                icon={FileJson}
                title="Evidence synthesis package"
                meta="JSON · PICOS, PRISMA, fields, meta-analysis"
                onClick={() => download("json")}
              />
              <DownloadRow
                icon={FileSpreadsheet}
                title="Annex 8 extraction table"
                meta="CSV · one row per study"
                onClick={() => download("csv")}
              />
              <DownloadRow
                icon={History}
                title="Verification audit trail"
                meta="JSON · every accept / correct / reject"
                onClick={() => download("audit")}
              />
            </CardContent>
          </Card>

          <Card className="p-5">
            <div className="text-[12.5px] font-medium text-ink-soft">Package contents</div>
            <ul className="mt-2.5 space-y-1.5 text-[13px] text-ink">
              {[
                "PICOS and eligibility criteria",
                "PRISMA 2020 flow counts",
                "Risk-of-bias judgements (RoB 2)",
                `${activeIds.size} schema-mapped fields per study`,
                "Source provenance for every value",
                "Random-effects meta-analysis",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-brand-600" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(["annex8", "consort", "prisma"] as const)
                .filter((k) => config.schemas[k])
                .map((k) => (
                  <Badge key={k} variant="default">
                    {k === "annex8" ? "Annex 8" : k.toUpperCase()}
                  </Badge>
                ))}
            </div>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            <LayoutDashboard /> Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

function DownloadRow({
  icon: Icon,
  title,
  meta,
  onClick,
}: {
  icon: typeof FileJson;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-left transition-all hover:border-brand-300 hover:bg-brand-50/50"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        <span className="block text-[11.5px] text-ink-muted">{meta}</span>
      </span>
      <Download className="size-4 text-ink-muted transition-colors group-hover:text-brand-700" />
    </button>
  );
}

function Highlighted({ json }: { json: string }) {
  const parts = json.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        let cls = "";
        if (/^".*":$/.test(p.replace(/\s/g, ""))) cls = "text-[#8fd3b8]";
        else if (p.startsWith('"')) cls = "text-[#f2d7a6]";
        else if (/^-?\d/.test(p)) cls = "text-[#9ecbff]";
        else if (/^(true|false|null)$/.test(p)) cls = "text-[#f0a6a0]";
        return (
          <span key={i} className={cn(cls)}>
            {p}
          </span>
        );
      })}
    </>
  );
}
