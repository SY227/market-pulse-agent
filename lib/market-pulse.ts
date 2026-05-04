import type {
  AnalysisResponse,
  ExecutiveVerdict,
  PublicEvidenceStatus,
  PulseLabel,
  SampleCase,
  ScoreStrength,
  SourceReceipt,
  SubScore,
  SubScoreKey,
  WorkflowStep,
} from "@/lib/types";

export const APP_NAME = "Market Pulse Agent";
export const TAGLINE = "Before you build it, check the market pulse.";
export const MODEL_NAME = "gemini-2.5-flash-lite";

export const SAMPLE_CASES: SampleCase[] = [
  {
    name: "Cursor",
    websiteUrl: "https://cursor.com",
    businessQuestion:
      "Should Cursor launch an AI release-safety agent that reviews agent-written code before it reaches production?",
    compactDescription: "Release-safety checks for AI-written code",
    targetCustomer:
      "Engineering leaders, AI-native product teams, and startups shipping with coding agents",
    notes:
      "Test whether the first wedge should be production-readiness reviews for teams using AI coding agents daily.",
  },
  {
    name: "Shopify",
    websiteUrl: "https://shopify.com",
    businessQuestion:
      "Should Shopify launch an AI commerce-readiness agent that tells merchants whether their products are discoverable and buyable inside ChatGPT, Gemini, and Perplexity?",
    compactDescription: "AI commerce readiness for merchants",
    targetCustomer:
      "Shopify merchants, ecommerce operators, and growth teams preparing for agentic commerce",
    notes:
      "Focus on merchants worried that AI assistants may become the new storefront and discovery layer.",
  },
];

export const AGENT_STEPS = [
  "Website Context Agent",
  "Public Signal Scout",
  "Pain / Demand Cluster Agent",
  "Skepticism & Risk Agent",
  "Market Pulse Scoring Agent",
  "Validation Move Agent",
] as const;

export const SUB_SCORE_META: Record<
  SubScoreKey,
  { label: string; description: string }
> = {
  demandSignal: {
    label: "Demand Signal",
    description: "How clearly public signals point to active buyer interest.",
  },
  painIntensity: {
    label: "Pain Intensity",
    description: "How urgent, frequent, and expensive the problem looks.",
  },
  marketTiming: {
    label: "Market Timing",
    description: "How favorable the current moment is for this wedge.",
  },
  adoptionFriction: {
    label: "Adoption Friction",
    description: "How hard trust, workflow change, or switching costs may be.",
  },
};

export const PULSE_BANDS: Array<{
  label: PulseLabel;
  min: number;
  max: number;
  accent: string;
}> = [
  { label: "Weak Signal", min: 0, max: 24, accent: "#8f98a3" },
  { label: "Early Signal", min: 25, max: 44, accent: "#5e8fff" },
  { label: "Mixed Signal", min: 45, max: 59, accent: "#7a6ff0" },
  { label: "Promising Signal", min: 60, max: 79, accent: "#009b8a" },
  { label: "Strong Signal", min: 80, max: 100, accent: "#0071e3" },
];

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function assertNonEmptyText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Gemini returned an incomplete analysis: missing ${field}.`);
  }
}

function assertSubScore(
  subScores: AnalysisResponse["subScores"] | Partial<AnalysisResponse["subScores"]> | undefined,
  key: SubScoreKey,
) {
  const score = subScores?.[key];

  if (!score || typeof score.score !== "number" || !Number.isFinite(score.score)) {
    throw new Error(`Gemini returned an incomplete analysis: missing ${key} score.`);
  }

  assertNonEmptyText(score.explanation, `${key} explanation`);
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeMarketPulseScore(options: {
  subScores: AnalysisResponse["subScores"];
  evidenceQuality: number;
  groundedSourceCount: number;
  fetchedPageCount: number;
  relevantPageCount: number;
  averageRelevanceScore: number;
  maxDirectSupportScore: number;
  hasWebsiteContext: boolean;
}) {
  const demand = clampScore(options.subScores.demandSignal.score);
  const pain = clampScore(options.subScores.painIntensity.score);
  const timing = clampScore(options.subScores.marketTiming.score);
  const friction = clampScore(options.subScores.adoptionFriction.score);

  const baseSignal =
    demand * 0.34 + pain * 0.26 + timing * 0.22 + (100 - friction) * 0.18;
  const evidenceFactor = 0.42 + (clampScore(options.evidenceQuality) / 100) * 0.42;
  const supportBonus = Math.min(
    12,
    options.groundedSourceCount * 1.5 +
      options.relevantPageCount * 1.2 +
      options.averageRelevanceScore * 0.05 +
      options.maxDirectSupportScore * 0.08,
  );
  const relevancePenalty = options.relevantPageCount <= 1 ? 6 : options.relevantPageCount <= 2 ? 3 : 0;
  const websitePenalty = options.hasWebsiteContext ? 0 : 10;

  return clampScore(baseSignal * evidenceFactor + supportBonus - relevancePenalty - websitePenalty);
}

export function getPulseLabel(score: number): PulseLabel {
  return (
    PULSE_BANDS.find((band) => score >= band.min && score <= band.max)?.label ??
    "Mixed Signal"
  );
}

export function getPulseAccent(score: number) {
  return (
    PULSE_BANDS.find((band) => score >= band.min && score <= band.max)?.accent ??
    "#7a6ff0"
  );
}

export function getVerdict(
  score: number,
  evidenceQuality: number,
): ExecutiveVerdict {
  if (evidenceQuality < 35 && score < 50) return "Not enough public evidence";
  if (score >= 80) return "Strongly worth testing";
  if (score >= 60) return "Worth testing with a narrow wedge";
  if (score >= 45) return "Mixed signal, validate before building";
  return "Weak signal, reposition first";
}

export function getPublicEvidenceStatus(
  evidenceQuality: number,
  groundedSourceCount: number,
  searchAttempted: boolean,
): PublicEvidenceStatus {
  if (groundedSourceCount >= 4 && evidenceQuality >= 70) {
    return "Strong public web grounding";
  }

  if (groundedSourceCount > 0 || searchAttempted || evidenceQuality >= 35) {
    return "Limited public web grounding";
  }

  return "Public web grounding unavailable";
}

export function getStrengthTone(strength: ScoreStrength) {
  if (strength === "High") return "text-[#0071e3] bg-[#eaf2ff]";
  if (strength === "Medium") return "text-[#5f5adb] bg-[#efedff]";
  return "text-[#6e7781] bg-[#f3f4f6]";
}

export function getEvidenceTone(status: PublicEvidenceStatus) {
  if (status === "Strong public web grounding") {
    return "text-[#036672] bg-[#e6fffb] ring-[#a7f3d0]";
  }

  if (status === "Limited public web grounding") {
    return "text-[#6b4f00] bg-[#fff7dd] ring-[#fde68a]";
  }

  return "text-[#6e7781] bg-[#f3f4f6] ring-[#e5e7eb]";
}

export function buildFallbackReceipts(options: {
  websiteUrl: string;
  title?: string;
  description?: string;
  summary?: string;
  pageSnapshots?: { url: string; title: string; description: string; summary: string }[];
}): SourceReceipt[] {
  const snapshots = (options.pageSnapshots ?? []).slice(0, 4);
  const receipts = snapshots
    .map<SourceReceipt | null>((snapshot) => {
      const signal =
        cleanText(snapshot.description) || cleanText(snapshot.summary).slice(0, 220) || "";

      if (!signal) return null;

      return {
        sourceName: cleanText(snapshot.title) || hostnameFromUrl(snapshot.url),
        sourceUrl: snapshot.url,
        signal,
        whyItMatters:
          snapshot.url === options.websiteUrl
            ? "This first-party page anchors the company’s current positioning and category language."
            : "This first-party page adds more specific context about product surfaces, audiences, or commercial framing.",
        strength: "High",
      };
    })
    .filter((receipt): receipt is SourceReceipt => receipt !== null);

  if (receipts.length > 0) {
    return receipts.slice(0, 6);
  }

  const signal =
    cleanText(options.description) || cleanText(options.summary).slice(0, 220) || "";

  if (!signal) {
    return [];
  }

  return [
    {
      sourceName: cleanText(options.title) || hostnameFromUrl(options.websiteUrl),
      sourceUrl: options.websiteUrl,
      signal,
      whyItMatters:
        "This first-party page is the direct positioning evidence available for the company or product being analyzed.",
      strength: "High",
    },
  ];
}

export function buildWorkflowTrace(
  notes: Partial<Record<(typeof AGENT_STEPS)[number], string>>,
  limitedSteps: Set<string>,
) {
  return AGENT_STEPS.map<WorkflowStep>((agent) => ({
    agent,
    note: notes[agent] ?? "Completed this step with the evidence available.",
    status: limitedSteps.has(agent) ? "limited" : "done",
  }));
}

function emptySubScore(explanation: string): SubScore {
  return {
    score: 0,
    explanation,
  };
}

export function buildMinimalNoEvidenceAnalysis(message: string): AnalysisResponse {
  return {
    marketPulseScore: 0,
    marketPulseLabel: "Weak Signal",
    verdict: "Not enough public evidence",
    shortSummary: message,
    verdictSentence: "There is not enough public evidence to assess this wedge yet.",
    subScores: {
      demandSignal: emptySubScore("No reliable demand evidence was available for this run."),
      painIntensity: emptySubScore("No reliable pain evidence was available for this run."),
      marketTiming: emptySubScore("No reliable timing evidence was available for this run."),
      adoptionFriction: emptySubScore("No reliable adoption evidence was available for this run."),
    },
    publicThemes: [],
    positiveSignals: [],
    objections: [],
    competitiveAlternatives: [],
    bestWedge: "",
    nextValidationMove: {
      type: "Input correction",
      recommendation:
        "Enter a valid company or product URL, or provide source notes that describe the market and wedge you want assessed.",
      exampleCopy:
        "Example: https://company.com plus a short note about the proposed product, customer, and workflow you want evaluated.",
    },
    sourceReceipts: [],
    evidenceLimitations: message,
    workflowTrace: AGENT_STEPS.map((agent) => ({
      agent,
      note: "No usable website or grounded public evidence was available.",
      status: "limited",
    })),
    evidenceQuality: 0,
    publicEvidenceStatus: "Public web grounding unavailable",
    websiteContext: undefined,
  };
}

export function assertModelAnalysisShape(result: Partial<AnalysisResponse>) {
  assertNonEmptyText(result.shortSummary, "shortSummary");
  assertNonEmptyText(result.verdictSentence, "verdictSentence");
  assertNonEmptyText(result.bestWedge, "bestWedge");
  assertNonEmptyText(result.nextValidationMove?.type, "nextValidationMove.type");
  assertNonEmptyText(
    result.nextValidationMove?.recommendation,
    "nextValidationMove.recommendation",
  );
  assertNonEmptyText(result.nextValidationMove?.exampleCopy, "nextValidationMove.exampleCopy");

  assertSubScore(result.subScores, "demandSignal");
  assertSubScore(result.subScores, "painIntensity");
  assertSubScore(result.subScores, "marketTiming");
  assertSubScore(result.subScores, "adoptionFriction");

  const publicThemes = Array.isArray(result.publicThemes) ? result.publicThemes : [];
  if (publicThemes.length === 0) {
    throw new Error("Gemini returned an incomplete analysis: missing publicThemes.");
  }

  publicThemes.forEach((theme, index) => {
    assertNonEmptyText(theme?.theme, `publicThemes[${index}].theme`);
    assertNonEmptyText(
      theme?.whatPeopleAreSaying,
      `publicThemes[${index}].whatPeopleAreSaying`,
    );
    assertNonEmptyText(theme?.whyItMatters, `publicThemes[${index}].whyItMatters`);
  });

  if (cleanStringArray(result.positiveSignals).length === 0) {
    throw new Error("Gemini returned an incomplete analysis: missing positiveSignals.");
  }

  if (cleanStringArray(result.objections).length === 0) {
    throw new Error("Gemini returned an incomplete analysis: missing objections.");
  }

  if (cleanStringArray(result.competitiveAlternatives).length === 0) {
    throw new Error(
      "Gemini returned an incomplete analysis: missing competitiveAlternatives.",
    );
  }
}

export function ensureAnalysisShape(
  result: Partial<AnalysisResponse>,
  options: {
    websiteUrl: string;
    evidenceQuality: number;
    publicEvidenceStatus: PublicEvidenceStatus;
    evidenceLimitations: string;
    workflowTrace: WorkflowStep[];
    sourceReceipts: SourceReceipt[];
    fetchedPageCount: number;
    relevantPageCount: number;
    averageRelevanceScore: number;
    maxDirectSupportScore: number;
    groundedSourceCount: number;
    hasWebsiteContext: boolean;
  },
): AnalysisResponse {
  assertModelAnalysisShape(result);

  const evidenceQuality = clampScore(result.evidenceQuality ?? options.evidenceQuality);
  const marketPulseScore = computeMarketPulseScore({
    subScores: {
      demandSignal: {
        score: clampScore(result.subScores!.demandSignal.score),
        explanation: cleanText(result.subScores!.demandSignal.explanation),
      },
      painIntensity: {
        score: clampScore(result.subScores!.painIntensity.score),
        explanation: cleanText(result.subScores!.painIntensity.explanation),
      },
      marketTiming: {
        score: clampScore(result.subScores!.marketTiming.score),
        explanation: cleanText(result.subScores!.marketTiming.explanation),
      },
      adoptionFriction: {
        score: clampScore(result.subScores!.adoptionFriction.score),
        explanation: cleanText(result.subScores!.adoptionFriction.explanation),
      },
    },
    evidenceQuality,
    groundedSourceCount: options.groundedSourceCount,
    fetchedPageCount: options.fetchedPageCount,
    relevantPageCount: options.relevantPageCount,
    averageRelevanceScore: options.averageRelevanceScore,
    maxDirectSupportScore: options.maxDirectSupportScore,
    hasWebsiteContext: options.hasWebsiteContext,
  });
  const verdict = getVerdict(marketPulseScore, evidenceQuality);
  const marketPulseLabel = getPulseLabel(marketPulseScore);
  const sourceReceipts =
    Array.isArray(result.sourceReceipts) && result.sourceReceipts.length > 0
      ? result.sourceReceipts
          .map((receipt) => ({
            sourceName: cleanText(receipt.sourceName),
            sourceUrl: cleanText(receipt.sourceUrl) || undefined,
            signal: cleanText(receipt.signal),
            whyItMatters: cleanText(receipt.whyItMatters),
            strength: receipt.strength,
          }))
          .filter(
            (receipt) =>
              receipt.sourceName && receipt.signal && receipt.whyItMatters,
          )
          .slice(0, 6)
      : options.sourceReceipts;

  return {
    marketPulseScore,
    marketPulseLabel,
    verdict,
    shortSummary: cleanText(result.shortSummary),
    verdictSentence: cleanText(result.verdictSentence),
    subScores: {
      demandSignal: {
        score: clampScore(result.subScores!.demandSignal.score),
        explanation: cleanText(result.subScores!.demandSignal.explanation),
      },
      painIntensity: {
        score: clampScore(result.subScores!.painIntensity.score),
        explanation: cleanText(result.subScores!.painIntensity.explanation),
      },
      marketTiming: {
        score: clampScore(result.subScores!.marketTiming.score),
        explanation: cleanText(result.subScores!.marketTiming.explanation),
      },
      adoptionFriction: {
        score: clampScore(result.subScores!.adoptionFriction.score),
        explanation: cleanText(result.subScores!.adoptionFriction.explanation),
      },
    },
    publicThemes: result.publicThemes!.map((theme) => ({
      theme: cleanText(theme.theme),
      whatPeopleAreSaying: cleanText(theme.whatPeopleAreSaying),
      whyItMatters: cleanText(theme.whyItMatters),
    })),
    positiveSignals: cleanStringArray(result.positiveSignals),
    objections: cleanStringArray(result.objections),
    competitiveAlternatives: cleanStringArray(result.competitiveAlternatives),
    bestWedge: cleanText(result.bestWedge),
    nextValidationMove: {
      type: cleanText(result.nextValidationMove!.type),
      recommendation: cleanText(result.nextValidationMove!.recommendation),
      exampleCopy: cleanText(result.nextValidationMove!.exampleCopy),
    },
    sourceReceipts,
    evidenceLimitations: cleanText(result.evidenceLimitations) || options.evidenceLimitations,
    workflowTrace: options.workflowTrace,
    evidenceQuality,
    publicEvidenceStatus: options.publicEvidenceStatus,
    websiteContext: result.websiteContext,
  };
}
