export type ScoreStrength = "High" | "Medium" | "Low";

export type PulseLabel =
  | "Weak Signal"
  | "Early Signal"
  | "Mixed Signal"
  | "Promising Signal"
  | "Strong Signal";

export type ExecutiveVerdict =
  | "Strongly worth testing"
  | "Worth testing with a narrow wedge"
  | "Mixed signal, validate before building"
  | "Weak signal, reposition first"
  | "Not enough public evidence";

export type PublicEvidenceStatus =
  | "Strong public web grounding"
  | "Limited public web grounding"
  | "Public web grounding unavailable";

export type SubScoreKey =
  | "demandSignal"
  | "painIntensity"
  | "marketTiming"
  | "adoptionFriction";

export type SubScore = {
  score: number;
  explanation: string;
};

export type PublicTheme = {
  theme: string;
  whatPeopleAreSaying: string;
  whyItMatters: string;
};

export type NextValidationMove = {
  type: string;
  recommendation: string;
  exampleCopy: string;
};

export type SourceReceipt = {
  sourceName: string;
  sourceUrl?: string;
  signal: string;
  whyItMatters: string;
  strength: ScoreStrength;
};

export type WorkflowStep = {
  agent: string;
  note: string;
  status: "done" | "limited";
};

export type WebsitePageSnapshot = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  summary: string;
  relevanceScore: number;
  directSupportScore: number;
};

export type WebsiteContext = {
  requestedUrl: string;
  resolvedUrl: string;
  title: string;
  description: string;
  headings: string[];
  summary: string;
  fetchSucceeded: boolean;
  pageSnapshots: WebsitePageSnapshot[];
  fetchedPageCount: number;
  relevantPageCount: number;
  averageRelevanceScore: number;
  maxDirectSupportScore: number;
  limitation?: string;
};

export type AnalysisResponse = {
  marketPulseScore: number;
  marketPulseLabel: PulseLabel | string;
  verdict: ExecutiveVerdict | string;
  shortSummary: string;
  verdictSentence: string;
  subScores: Record<SubScoreKey, SubScore>;
  publicThemes: PublicTheme[];
  positiveSignals: string[];
  objections: string[];
  competitiveAlternatives: string[];
  bestWedge: string;
  nextValidationMove: NextValidationMove;
  sourceReceipts: SourceReceipt[];
  evidenceLimitations: string;
  workflowTrace: WorkflowStep[];
  evidenceQuality: number;
  publicEvidenceStatus: PublicEvidenceStatus;
  websiteContext?: Pick<
    WebsiteContext,
    | "title"
    | "description"
    | "summary"
    | "resolvedUrl"
    | "fetchedPageCount"
    | "relevantPageCount"
    | "averageRelevanceScore"
    | "maxDirectSupportScore"
  >;
};

export type AnalysisRequest = {
  websiteUrl: string;
  businessQuestion: string;
  targetCustomer?: string;
  notes?: string;
};

export type SampleCase = {
  name: string;
  websiteUrl: string;
  businessQuestion: string;
  compactDescription: string;
  targetCustomer: string;
  notes?: string;
};
