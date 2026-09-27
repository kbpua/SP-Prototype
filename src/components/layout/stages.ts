import { Download, Filter, ScanText, Settings2, ShieldCheck, Sigma, type LucideIcon } from "lucide-react";
import type { StageKey } from "@/state/ReviewContext";

export interface StageDef {
  key: StageKey;
  path: string;
  label: string;
  short: string;
  icon: LucideIcon;
  mode: "setup" | "automated" | "human" | "hybrid" | "output";
}

export const STAGES: StageDef[] = [
  { key: "config", path: "/review/config", label: "Review configuration", short: "Configure", icon: Settings2, mode: "setup" },
  { key: "screening", path: "/review/screening", label: "Screening", short: "Screening", icon: Filter, mode: "hybrid" },
  { key: "appraisal", path: "/review/appraisal", label: "Critical appraisal", short: "Appraisal", icon: ShieldCheck, mode: "human" },
  { key: "extraction", path: "/review/extraction", label: "Extraction & verification", short: "Extraction", icon: ScanText, mode: "hybrid" },
  { key: "synthesis", path: "/review/synthesis", label: "Synthesis", short: "Synthesis", icon: Sigma, mode: "automated" },
  { key: "export", path: "/review/export", label: "Export", short: "Export", icon: Download, mode: "output" },
];

export const MODE_LABEL: Record<StageDef["mode"], string> = {
  setup: "Setup",
  automated: "Automated",
  human: "Human only",
  hybrid: "AI + human",
  output: "Output",
};