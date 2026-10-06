import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileX2,
  History,
  LayoutDashboard,
  PartyPopper,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { GUIDE_REFS, GuideRef } from "@/components/guide";
import { activeFieldIds, appraisalItemCount, useReview, usesAmstar } from "@/state/ReviewContext";
import { ACTIVE_REVIEW_ID, CANDIDATE_STUDIES, SCREENING_RATIONALES, getExtractedFields } from "@/data/mockData";
import { dersimonianLaird } from "@/lib/meta";
import {
  ANNEX8_EXTENSIONS,
  ANNEX8_HEADERS,
  GRADE_DOMAINS,
  amstarOverall,
  annex8Row,
  buildStudyInputs,
  csvEscape,
  finalValues,
  gradeSuggestions,
  robOverall,
} from "@/lib/review";
import { cn } from "@/lib/utils";

type Format = "json" | "annex8" | "csv" | "audit" | "ineligibility";

export default function Export() {
  const navigate = useNavigate();
  const {
    config,
    screening,
    rationales,
    designs,
    designOf,
    included,
    extractable,
    reviewsOnly,
    verification,
    appraisal,
    grade,
    prisma,
    stageProgress,
    visited,
    markVisited,
  } = useReview();
  const [format, setFormat] = useState<Format>("json");
  const [copied, setCopied] = useState(false);

  useEffect(() => markVisited("export"), [markVisited]);

  const activeIds = activeFieldIds(config.schemas);
  const measure = config.effectMeasure === "MD" ? "RR" : config.effectMeasure;
  const { inputs } = buildStudyInputs(extractable, verification);
  const pooled = dersimonianLaird(measure, inputs);

  const fieldsTotal = extractable.length * activeIds.size;
  const fieldsVerified = extractable.reduce(
    (acc, s) => acc + [...activeIds].filter((id) => (verification[s.id]?.[id]?.status ?? "pending") !== "pending").length,
    0,
  );

  const gradeSuggested = gradeSuggestions(
    pooled,
    inputs.map((i) => robOverall(appraisal[i.id]).label),
  );

  const annex8Rows = extractable.map((s) => ({ study: s, ...annex8Row(s, verification, appraisal, activeIds) }));

  const appraisalTally = (tool: "rob2" | "amstar") => {
    const studies = included.filter((s) => (tool === "amstar") === usesAmstar(s, designs));
    const total = studies.reduce((a, s) => a + appraisalItemCount(s, designs), 0);
    const done = studies.reduce((a, s) => a + Object.values(appraisal[s.id] ?? {}).filter((d) => d.judgement).length, 0);
    return { total, done };
  };
  const rob2Tally = appraisalTally("rob2");
  const amstarTally = appraisalTally("amstar");

  const remaining: string[] = [];
  if (!config.configured) remaining.push("configuration not confirmed");
  if (prisma.undecided > 0) remaining.push(`${prisma.undecided} records undecided`);
  if (prisma.maybe > 0) remaining.push(`${prisma.maybe} marked Maybe`);
  if (rob2Tally.done < rob2Tally.total) remaining.push(`appraisal ${rob2Tally.done}/${rob2Tally.total} RoB 2 domains`);
  if (amstarTally.done < amstarTally.total)
    remaining.push(`appraisal ${amstarTally.done}/${amstarTally.total} AMSTAR 2 items`);
  if (fieldsVerified < fieldsTotal) remaining.push(`${fieldsTotal - fieldsVerified} fields awaiting verification`);
  if (!visited.includes("synthesis")) remaining.push("synthesis not reviewed");
  const complete = remaining.length === 0;
  const appraisalIncomplete = stageProgress.appraisal < 100;

  const build = (format: Format): string => {
    if (format === "json") {
      const data = {
        review_id: ACTIVE_REVIEW_ID,
        title: config.title,
        framework: "Aligned to the Philippine HTA Methods Guide (DOH-HTAC, RA 11223)",
        exported_at: new Date().toISOString(),
        pipeline_status: complete ? "complete" : "incomplete",
        picos: {
          population: config.population,
          intervention: config.intervention,
          comparator: config.comparator,
          outcome: config.outcome,
          study_design: config.studyDesign,
        },
        prisma: {
          identified: prisma.identified,
          duplicates_removed: prisma.duplicates,
          screened: prisma.screened,
          excluded: prisma.excluded,
          excluded_by_code: prisma.byCode,
          included: prisma.included,
          maybe: prisma.maybe,
          undecided: prisma.undecided,
        },
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
                .map((f) => {
                  const ver = verification[s.id]?.[f.def.id];
                  return [
                    f.def.id,
                    {
                      value: v[f.def.id],
                      status: ver?.status ?? "pending",
                      ...(ver?.batch ? { accepted_in_batch: true } : {}),
                      confidence: f.confidence,
                      source: f.def.source,
                      schema: f.def.schemas.filter((x) => config.schemas[x.key]).map((x) => `${x.key}:${x.item}`),
                    },
                  ];
                }),
            ),
          };
        }),
        systematic_reviews_appraised: reviewsOnly.map((s) => ({
          id: s.id,
          citation: `${s.authors} (${s.year}). ${s.journal}.`,
          tool: "AMSTAR 2",
          overall_confidence: amstarOverall(appraisal[s.id]).label,
          note: "Appraised only; not extracted or pooled (RCT-only scope).",
        })),
        meta_analysis: pooled && {
          model: "random-effects (DerSimonian–Laird)",
          measure,
          k: pooled.studies.length,
          estimate: +pooled.est.toFixed(3),
          ci_95: [+pooled.lo.toFixed(3), +pooled.hi.toFixed(3)],
          p_value: +pooled.p.toExponential(3),
          heterogeneity:
            pooled.studies.length < 2
              ? { estimable: false, note: "Not estimable (k = 1); Q df = 0" }
              : {
                  i2: +pooled.i2.toFixed(1),
                  tau2: +pooled.tau2.toFixed(4),
                  q: +pooled.q.toFixed(2),
                  df: pooled.df,
                },
        },
        grade: {
          outcome: "Primary composite outcome",
          domains: Object.fromEntries(
            GRADE_DOMAINS.map((d) => {
              const set = grade.domains[d.id];
              const value = set ?? gradeSuggested[d.id] ?? null;
              return [
                d.id,
                { value, source: set ? "analyst-entered" : value ? "system-suggested" : "not entered" },
              ];
            }),
          ),
          overall_certainty: grade.overall ?? null,
          note: "System suggests, analyst decides. Overall certainty is analyst-entered.",
        },
      };
      return JSON.stringify(data, null, 2);
    }
    if (format === "csv" || format === "annex8") {
      const header = [...ANNEX8_HEADERS, ...ANNEX8_EXTENSIONS.map((e) => e.key)].map(csvEscape).join(",");
      const rows = annex8Rows.map((r) => [...r.annex8, ...r.extensions].map(csvEscape).join(","));
      return [header, ...rows].join("\n");
    }
    if (format === "ineligibility") {
      const header = ["record", "design", "code", "rationale", "decided_by", "status"].join(",");
      const rows = CANDIDATE_STUDIES.flatMap((s) => {
        const record = `${s.id} · ${s.authors.split(",")[0]} ${s.year} · ${s.title}`;
        if (s.duplicateOf) {
          return [[record, designOf(s), "", `Duplicate of ${s.duplicateOf}`, "HTA Analyst", "Duplicate removed (not coded)"]];
        }
        const d = screening[s.id];
        if (d?.decision !== "exclude") return [];
        return [
          [
            record,
            designOf(s),
            d.code ? (d.code === "Other" && d.codeNote ? `Other: ${d.codeNote}` : d.code) : "",
            rationales[s.id] ?? SCREENING_RATIONALES[s.id] ?? "",
            "HTA Analyst",
            `Excluded (confirmed) · ${d.codeEdited ? "Analyst-edited code" : "System-suggested code"}`,
          ],
        ];
      });
      return [header, ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
    }
    const log = extractable.flatMap((s) =>
      getExtractedFields(s.trial!)
        .filter((f) => verification[s.id]?.[f.def.id] && verification[s.id]?.[f.def.id]?.status !== "pending")
        .map((f) => {
          const ver = verification[s.id]![f.def.id]!;
          return {
            study: s.trial?.acronym,
            field: f.def.id,
            action: ver.batch ? "accepted in batch" : ver.status,
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
    const isCsv = fmt === "csv" || fmt === "annex8" || fmt === "ineligibility";
    const blob = new Blob([build(fmt)], { type: isCsv ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = {
      json: "evidence-synthesis.json",
      annex8: "annex8-extraction.csv",
      csv: "annex8-extraction.csv",
      audit: "audit-trail.json",
      ineligibility: "ineligibility-log.csv",
    }[fmt];
    a.download = `${ACTIVE_REVIEW_ID}_${name}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const funnel = [
    { label: "Identified", value: prisma.identified, sub: `${prisma.duplicates} duplicate removed` },
    { label: "Screened", value: prisma.screened, sub: `${prisma.excluded} excluded by code` },
    { label: "Included", value: prisma.included, sub: `${reviewsOnly.length} SR appraised only` },
    { label: "Extracted", value: extractable.length, sub: `${fieldsVerified}/${fieldsTotal} fields verified` },
    { label: "Synthesised", value: pooled?.studies.length ?? 0, sub: pooled ? `${measure} ${pooled.est.toFixed(2)}` : "—" },
  ];

  const corrections = Object.values(verification).reduce(
    (acc, v) => acc + Object.values(v).filter((f) => f?.status === "corrected").length,
    0,
  );

  return (
    <PageContainer className="pb-6 lg:pb-8">
      <PageHeader
        step="Stage 6 of 6"
        title="Export"
        description="Download the structured evidence package for the HTAC technical working group. Every value carries its verification status and source location."
      />

      <Card className={cn("shrink-0 overflow-hidden", complete ? "border-brand-200" : "border-flag/40")}>
        {complete ? (
          <div className="flex items-center gap-2.5 bg-brand-700 px-5 py-2 text-white">
            <PartyPopper className="size-4 shrink-0" />
            <div className="min-w-0 truncate text-[12.5px] text-brand-100">
              <span className="text-[13.5px] font-semibold text-white">Pipeline complete</span>
              <span className="mx-1.5">·</span>
              From {prisma.identified} records to a pooled estimate — with {corrections} human correction(s) applied
              along the way.
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5 border-b border-flag/30 bg-flag-soft px-5 py-2 text-[#854408]"
            title={remaining.join(" · ")}
          >
            <AlertTriangle className="size-4 shrink-0" />
            <div className="min-w-0 truncate text-[12.5px]">
              <span className="text-[13.5px] font-semibold">Pipeline incomplete</span>
              <span className="mx-1.5">·</span>
              Remaining: {remaining.join(" · ")}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-2 items-stretch px-4 py-2.5">
          {funnel.map((f, i) => (
            <div key={f.label} className="relative flex flex-col items-center text-center px-2">
              {i < funnel.length - 1 && (
                <ChevronRight className="hidden md:block absolute top-1/2 -translate-y-1/2 -right-2.5 size-4 text-brand-300" />
              )}
              <div className="text-[11.5px] font-medium text-ink-muted">{f.label}</div>
              <div className="mt-0.5 text-[24px] font-semibold leading-none tracking-tight tabular text-brand-700">
                <AnimatedNumber value={f.value} duration={600 + i * 150} />
              </div>
              <div className="mt-1 max-w-full truncate text-[11.5px] text-ink-soft">{f.sub}</div>
            </div>
          ))}
        </div>
        {appraisalIncomplete && (
          <div className="truncate border-t border-line bg-cream/50 px-5 py-1 text-[11.5px] text-ink-muted">
            Appraisal is incomplete: risk-of-bias judgements in this export are partial. You can return to Appraisal to
            finish.
          </div>
        )}
      </Card>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="col-span-1 lg:col-span-2 flex h-[520px] min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-var(--topbar-h)-3rem)] lg:min-h-[420px]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-3">
            <Segmented<Format>
              size="sm"
              value={format}
              onChange={setFormat}
              options={[
                { value: "json", label: "JSON" },
                { value: "annex8", label: "Annex 8 table" },
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
          {format === "annex8" ? (
            <Annex8Table rows={annex8Rows.map((r) => ({ id: r.study.id, cells: r.annex8, ext: r.extensions }))} />
          ) : (
            <pre
              key={format}
              className="min-h-0 flex-1 animate-fade-in overflow-auto whitespace-pre-wrap break-words bg-[#10231d] px-5 py-4 font-mono text-[12px] leading-relaxed text-brand-100 scrollbar-thin"
            >
              {format === "csv" ? content : <Highlighted json={content} />}
            </pre>
          )}
        </Card>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pt-4 pb-2.5">
              <CardTitle>Downloads</CardTitle>
              <CardDescription>Generated from the current verified state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <DownloadRow
                icon={FileJson}
                title="Evidence synthesis package"
                meta="JSON · PRISMA, fields, meta-analysis, GRADE"
                onClick={() => download("json")}
              />
              <DownloadRow
                icon={FileSpreadsheet}
                title="Annex 8 extraction table"
                meta="CSV · 8 Guide columns + ext_ fields"
                onClick={() => download("csv")}
              />
              <DownloadRow
                icon={FileX2}
                title="Ineligibility log"
                meta="CSV · code per excluded record"
                onClick={() => download("ineligibility")}
              />
              <DownloadRow
                icon={History}
                title="Verification audit trail"
                meta="JSON · every verification action"
                onClick={() => download("audit")}
              />
            </CardContent>
          </Card>

          <Card className="px-5 py-4">
            <div className="text-[12.5px] font-medium text-ink-soft">Package contents</div>
            <ul className="mt-2 space-y-1 text-[13px] text-ink">
              {[
                "PICO question and eligibility criteria",
                "PRISMA 2020 flow counts",
                "Annex 8 table (8 columns + extensions)",
                "Ineligibility log (P/I/C/O/S codes)",
                "Risk-of-bias judgements (RoB 2 · AMSTAR 2)",
                `${activeIds.size} schema-mapped fields per study`,
                "Source provenance for every value",
                "Random-effects meta-analysis",
                "GRADE certainty (analyst-entered)",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-brand-600" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["annex8", "prisma", "consort"] as const)
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
    </PageContainer>
  );
}

function Annex8Table({ rows }: { rows: { id: string; cells: string[]; ext: string[] }[] }) {
  return (
    <div className="min-h-0 flex-1 animate-fade-in overflow-auto scrollbar-thin">
      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
        <span className="text-[12px] text-ink-muted">One row per extracted study · values after verification</span>
        <GuideRef>{GUIDE_REFS.annex8}</GuideRef>
      </div>
      {rows.length === 0 ? (
        <div className="mx-5 rounded-lg border border-dashed border-line py-10 text-center text-[13px] text-ink-muted">
          No extracted studies yet.
        </div>
      ) : (
        <table className="min-w-[1500px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr className="text-[11px] text-ink-muted">
              <th colSpan={ANNEX8_HEADERS.length} className="border-b border-line bg-brand-50/60 px-3 py-1.5 text-left font-semibold text-brand-800">
                Annex 8 · sample data extraction table
              </th>
              <th
                colSpan={ANNEX8_EXTENSIONS.length}
                className="border-b border-l-4 border-line border-l-cream-dark bg-cream px-3 py-1.5 text-left font-semibold text-ink-soft"
              >
                Extension fields (not part of Annex 8)
              </th>
            </tr>
            <tr className="text-left text-[11.5px] text-ink-soft">
              {ANNEX8_HEADERS.map((h) => (
                <th key={h} className="border-b border-line bg-white px-3 py-2 align-bottom font-semibold">
                  {h}
                </th>
              ))}
              {ANNEX8_EXTENSIONS.map((e, i) => (
                <th
                  key={e.key}
                  className={cn(
                    "border-b border-line bg-cream/60 px-3 py-2 align-bottom font-medium text-ink-muted",
                    i === 0 && "border-l-4 border-l-cream-dark",
                  )}
                >
                  {e.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                {r.cells.map((c, i) => (
                  <td key={i} className={cn("max-w-[220px] border-b border-line/60 px-3 py-2.5 text-ink", i === 0 && "font-semibold whitespace-nowrap")}>
                    {c}
                  </td>
                ))}
                {r.ext.map((c, i) => (
                  <td
                    key={i}
                    className={cn(
                      "max-w-[240px] border-b border-line/60 bg-cream/30 px-3 py-2.5 text-ink-soft",
                      i === 0 && "border-l-4 border-l-cream-dark",
                    )}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-all hover:border-brand-300 hover:bg-brand-50/50"
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
