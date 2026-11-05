export const PROTOTYPE_CONFIG = {
  showOutOfScopeMocks: false, // AMSTAR 2 branch, Table 4 conformance panel, GRADE card: hidden when false
  hideSuggestionsUntilCommit: false, // system suggestions stay visible as a guide during human-in-the-loop review
  tieBreak: "adjudicator" as "adjudicator" | "reviewerA",
  synthesisGate: "block" as "block" | "warn",
};
