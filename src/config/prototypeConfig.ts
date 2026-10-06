export const PROTOTYPE_CONFIG = {
  showOutOfScopeMocks: false, // AMSTAR 2 branch, Table 4 conformance panel, GRADE card: hidden when false
  hideSuggestionsUntilCommit: true, // system-suggested pills and relevance scores stay hidden until the reviewer commits
  tieBreak: "adjudicator" as "adjudicator" | "reviewerA",
  synthesisGate: "block" as "block" | "warn",
};
