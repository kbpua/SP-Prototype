import { createContext, useContext, type ReactNode } from "react";
import type { CandidateStudy, Confidence, FieldId, TrialData } from "@/data/mockData";
import type { FieldStatus } from "@/state/ReviewContext";
import { cn } from "@/lib/utils";

export interface HighlightInfo {
  label: string;
  confidence: Confidence;
  status: FieldStatus;
}

interface HighlightCtx {
  info: Partial<Record<FieldId, HighlightInfo>>;
  active?: FieldId;
  hovered?: FieldId;
  revealed: boolean;
  onSelect: (id: FieldId) => void;
  onHover: (id?: FieldId) => void;
  register: (id: FieldId, el: HTMLElement | null) => void;
}

export const HighlightContext = createContext<HighlightCtx | null>(null);

const pendingTone: Record<Confidence, string> = {
  high: "bg-brand-100/80 ring-brand-400",
  medium: "bg-flag-soft/90 ring-[#b45309]",
  low: "bg-coral-soft ring-coral",
};

const statusTone: Partial<Record<FieldStatus, string>> = {
  accepted: "bg-brand-50 ring-brand-600",
  corrected: "bg-sky-50 ring-sky-500",
  rejected: "bg-coral-soft/50 ring-coral/60 line-through decoration-coral text-ink-muted",
  adjudicate: "bg-flag-soft ring-[#b45309]",
};

function Hl({ id, children, block }: { id: FieldId; children: ReactNode; block?: boolean }) {
  const ctx = useContext(HighlightContext);
  const info = ctx?.info[id];
  if (!ctx || !info) return <>{children}</>;
  const isActive = ctx.active === id;
  const isHover = ctx.hovered === id;
  const tone = info.status === "pending" ? pendingTone[info.confidence] : statusTone[info.status];
  const Tag = block ? "div" : "span";

  return (
    <Tag
      ref={(el: HTMLElement | null) => ctx.register(id, el)}
      onClick={(e) => {
        e.stopPropagation();
        ctx.onSelect(id);
      }}
      onMouseEnter={() => ctx.onHover(id)}
      onMouseLeave={() => ctx.onHover(undefined)}
      className={cn(
        "relative cursor-pointer rounded-[3px] transition-all duration-500",
        block ? "block p-1 -m-1" : "px-[3px] -mx-[1px] py-[1px]",
        ctx.revealed ? cn("ring-[1.5px]", tone) : "ring-0 bg-transparent",
        (isActive || isHover) && ctx.revealed && "ring-2 shadow-[0_0_0_4px_rgb(29_158_117/0.15)] z-10",
        isActive && ctx.revealed && "ring-brand-700",
      )}
    >
      {children}
      {isActive && ctx.revealed && (
        <span className="pointer-events-none absolute -top-[22px] left-0 z-20 whitespace-nowrap rounded bg-brand-800 px-1.5 py-0.5 font-sans text-[10.5px] font-medium not-italic text-white no-underline shadow-md">
          {info.label}
        </span>
      )}
    </Tag>
  );
}

function pct(n: number, d: number) {
  return ((n / d) * 100).toFixed(1);
}

/** Deterministic pseudo-variation so derived table values look realistic. */
function jitter(seed: string, spread: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return ((h % 100) / 100 - 0.5) * 2 * spread;
}

export function MockDocument({ study }: { study: CandidateStudy }) {
  const t = study.trial as TrialData;
  const randomized = t.nT + t.nC;
  const age = parseFloat(t.meanAge);
  const female = parseFloat(t.female);
  const cvT = Math.round(t.eT * 0.44);
  const cvC = Math.round(t.eC * 0.43);
  const hfT = Math.round(t.eT * 0.63);
  const hfC = Math.round(t.eC * 0.64);
  const ratio = (a: number, b: number) => ((a / t.nT) / (b / t.nC));
  const ci = (r: number, w: number) => `${r.toFixed(2)} (${(r * (1 - w)).toFixed(2)}–${(r * (1 + w)).toFixed(2)})`;

  return (
    <div className="space-y-6 font-serif text-[12.5px] leading-[1.65] text-slate-800">
      {/* Page 1 */}
      <Page n={1} journal={study.journal} year={study.year}>
        <div className="mb-1 font-sans text-[10px] font-semibold tracking-[0.12em] text-brand-800">ORIGINAL RESEARCH</div>
        <h1 className="text-[19px] font-bold leading-snug text-slate-900">{study.title}</h1>
        <div className="mt-2 text-[12px] italic text-slate-600">{study.authors}</div>

        <div className="mt-4 rounded-sm border-l-2 border-slate-300 bg-slate-50/80 px-4 py-3 text-[12px]">
          <p>
            <b>Background.</b> Sodium–glucose cotransporter-2 inhibitors may reduce cardiovascular events in heart
            failure with reduced ejection fraction, but data in Asian populations remain limited.
          </p>
          <p className="mt-1.5">
            <b>Methods.</b> We conducted a randomised trial (<Hl id="registration">{t.registration}</Hl>) assigning
            patients to dapagliflozin or control in addition to recommended therapy.
          </p>
          <p className="mt-1.5">
            <b>Results.</b> A total of {randomized.toLocaleString()} patients underwent randomisation. The primary
            outcome occurred in {pct(t.eT, t.nT)}% of the dapagliflozin group and {pct(t.eC, t.nC)}% of the control
            group.
          </p>
        </div>

        <h2 className="mt-5 font-sans text-[13px] font-semibold text-slate-900">2. Methods</h2>
        <h3 className="mt-2 font-sans text-[12px] font-semibold text-slate-700">2.1 Study design and setting</h3>
        <p>
          This was a <Hl id="design">{t.designText.toLowerCase()}</Hl> conducted in{" "}
          <Hl id="country">{t.country}</Hl>. The protocol was approved by the ethics committee at each site, and all
          patients provided written informed consent.
        </p>
        <h3 className="mt-2 font-sans text-[12px] font-semibold text-slate-700">2.2 Participants</h3>
        <p>
          Eligible patients were <Hl id="population">{t.population.charAt(0).toLowerCase() + t.population.slice(1)}</Hl>{" "}
          with a left-ventricular ejection fraction of <Hl id="lvef">{t.lvef.replace("LVEF ", "")}</Hl> on
          echocardiography within 12 months before screening.
        </p>
        <h3 className="mt-2 font-sans text-[12px] font-semibold text-slate-700">2.3 Interventions</h3>
        <p>
          Patients were randomly assigned in a 1:1 ratio to receive <Hl id="intervention">{t.intervention.toLowerCase()}</Hl>{" "}
          or <Hl id="comparator">{t.comparator.toLowerCase()}</Hl>. Randomisation was stratified by diabetes status.
        </p>
        <h3 className="mt-2 font-sans text-[12px] font-semibold text-slate-700">2.4 Outcomes</h3>
        <p>
          The primary outcome was a <Hl id="primaryOutcome">{t.primaryOutcome.charAt(0).toLowerCase() + t.primaryOutcome.slice(1)}</Hl>,
          analysed as time to first event.
        </p>

        <figure className="mt-5">
          <div className="rounded-sm border border-slate-200 bg-white px-4 py-4 font-sans text-[11px]">
            <div className="flex flex-col items-center gap-2">
              <FlowNode>
                Assessed for eligibility (n = <Hl id="assessed">{t.assessed.toLocaleString()}</Hl>)
              </FlowNode>
              <div className="flex w-full items-center">
                <div className="flex-1" />
                <div className="h-4 w-px bg-slate-400" />
                <div className="flex flex-1 items-center">
                  <div className="h-px w-6 bg-slate-400" />
                  <FlowNode small>Excluded (n = {(t.assessed - randomized).toLocaleString()})</FlowNode>
                </div>
              </div>
              <FlowNode strong>
                Randomised (n = <Hl id="randomized">{randomized.toLocaleString()}</Hl>)
              </FlowNode>
              <div className="h-3 w-px bg-slate-400" />
              <div className="grid w-full grid-cols-2 gap-4">
                <FlowNode>
                  Allocated to dapagliflozin
                  <br />
                  (n = <Hl id="nT">{t.nT.toLocaleString()}</Hl>)
                </FlowNode>
                <FlowNode>
                  Allocated to control
                  <br />
                  (n = <Hl id="nC">{t.nC.toLocaleString()}</Hl>)
                </FlowNode>
              </div>
              <div className="grid w-full grid-cols-2 gap-4">
                <FlowNode small>
                  Lost to follow-up (n = <Hl id="lost">{t.lostT}</Hl>)
                </FlowNode>
                <FlowNode small>
                  Lost to follow-up (n = <Hl id="lost">{t.lostC}</Hl>)
                </FlowNode>
              </div>
              <div className="grid w-full grid-cols-2 gap-4">
                <FlowNode small>Analysed, ITT (n = {t.nT.toLocaleString()})</FlowNode>
                <FlowNode small>Analysed, ITT (n = {t.nC.toLocaleString()})</FlowNode>
              </div>
            </div>
          </div>
          <figcaption className="mt-1.5 text-[11px] text-slate-600">
            <b>Figure 1.</b> CONSORT flow diagram of patient enrolment, allocation, follow-up, and analysis.
          </figcaption>
        </figure>
      </Page>

      {/* Page 2 */}
      <Page n={2} journal={study.journal} year={study.year}>
        <h2 className="font-sans text-[13px] font-semibold text-slate-900">3. Results</h2>
        <h3 className="mt-2 font-sans text-[12px] font-semibold text-slate-700">3.1 Patients and follow-up</h3>
        <p>
          Baseline characteristics were well balanced between groups (Table 1). The median duration of follow-up was{" "}
          <Hl id="followUp">{t.followUp}</Hl>. Vital status was ascertained for more than 98% of patients.
        </p>

        <DocTable
          caption="Table 1. Baseline characteristics of the patients"
          head={["Characteristic", `Dapagliflozin (n = ${t.nT})`, `Control (n = ${t.nC})`, "Overall"]}
          rows={[
            [
              "Age, mean (SD), y",
              `${(age + jitter(study.id + "a", 0.4)).toFixed(1)}`,
              `${(age - jitter(study.id + "a", 0.4)).toFixed(1)}`,
              <Hl id="meanAge">{t.meanAge}</Hl>,
            ],
            [
              "Female sex, %",
              (female + jitter(study.id + "f", 0.6)).toFixed(1),
              (female - jitter(study.id + "f", 0.6)).toFixed(1),
              <Hl id="female">{t.female}</Hl>,
            ],
            ["NYHA class III–IV, %", (31 + jitter(study.id + "n", 3)).toFixed(1), (31.4 - jitter(study.id + "n", 3)).toFixed(1), "31.2"],
            ["LVEF, mean (SD), %", "31.2 (6.7)", "30.9 (6.9)", "31.1 (6.8)"],
            ["Type 2 diabetes, %", (41 + jitter(study.id + "d", 3)).toFixed(1), (41.5 - jitter(study.id + "d", 3)).toFixed(1), "41.3"],
          ]}
        />

        <h3 className="mt-4 font-sans text-[12px] font-semibold text-slate-700">3.2 Primary and secondary outcomes</h3>
        <p>
          The primary outcome occurred less frequently with dapagliflozin than with control (Table 2). Effects were
          consistent across pre-specified subgroups, including patients enrolled in Southeast Asian sites.
        </p>

        <DocTable
          caption="Table 2. Primary and secondary outcomes"
          head={["Outcome", "Dapagliflozin, n (%)", "Control, n (%)", "Hazard ratio (95% CI)", "p"]}
          rows={[
            [
              <b>Primary composite</b>,
              <>
                <Hl id="eT">{t.eT}</Hl> ({pct(t.eT, t.nT)})
              </>,
              <>
                <Hl id="eC">{t.eC}</Hl> ({pct(t.eC, t.nC)})
              </>,
              <Hl id="hr">{t.hr}</Hl>,
              <Hl id="p">{t.p}</Hl>,
            ],
            ["Cardiovascular death", `${cvT} (${pct(cvT, t.nT)})`, `${cvC} (${pct(cvC, t.nC)})`, ci(ratio(cvT, cvC), 0.18), "—"],
            ["HF hospitalisation", `${hfT} (${pct(hfT, t.nT)})`, `${hfC} (${pct(hfC, t.nC)})`, ci(ratio(hfT, hfC), 0.16), "—"],
          ]}
        />

        <DocTable
          caption="Table 3. Adverse events"
          head={["Event", "Dapagliflozin, n", "Control, n"]}
          rows={[
            ["Serious adverse event", <Hl id="sae">{t.saeT}</Hl>, <Hl id="sae">{t.saeC}</Hl>],
            ["Volume depletion", Math.round(t.nT * 0.071), Math.round(t.nC * 0.064)],
            ["Renal adverse event", Math.round(t.nT * 0.062), Math.round(t.nC * 0.071)],
            ["Major hypoglycaemia", Math.max(1, Math.round(t.nT * 0.002)), Math.max(1, Math.round(t.nC * 0.002))],
            ["Diabetic ketoacidosis", Math.round(t.nT * 0.001), 0],
          ]}
        />

        <p className="mt-4 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
          <b>Funding.</b> <Hl id="funding">{t.funding}</Hl>. The funders had no role in data analysis or the decision to
          publish.
        </p>
      </Page>
    </div>
  );
}

function Page({ n, journal, year, children }: { n: number; journal: string; year: number; children: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-[640px] bg-white px-10 pt-8 pb-10 shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_-8px_rgb(0_0_0/0.12)]">
      <div className="mb-5 flex justify-between border-b border-slate-200 pb-2 font-sans text-[10px] text-slate-500">
        <span className="italic">{journal}</span>
        <span>
          {year} · p. {n}
        </span>
      </div>
      {children}
    </div>
  );
}

function FlowNode({ children, small, strong }: { children: ReactNode; small?: boolean; strong?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-sm border px-3 text-center leading-snug",
        small ? "border-slate-300 py-1 text-[10.5px] text-slate-600" : "border-slate-500 py-1.5",
        strong && "border-slate-700 font-semibold",
      )}
    >
      {children}
    </div>
  );
}

function DocTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4">
      <div className="mb-1 font-sans text-[11px] font-semibold text-slate-800">{caption}</div>
      <table className="w-full border-y-2 border-slate-800 font-sans text-[11px]">
        <thead>
          <tr className="border-b border-slate-400">
            {head.map((h, i) => (
              <th key={i} className={cn("py-1.5 font-semibold", i === 0 ? "text-left" : "text-center")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn("py-1.5", j === 0 ? "text-left" : "text-center tabular")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
