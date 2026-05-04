import { GoogleGenAI, type GroundingMetadata } from "@google/genai";
import { NextResponse } from "next/server";

import { analysisJsonSchema } from "@/lib/analysis-schema";
import { getGeminiApiKey } from "@/lib/env";
import {
  AGENT_STEPS,
  MODEL_NAME,
  assertModelAnalysisShape,
  buildFallbackReceipts,
  buildMinimalNoEvidenceAnalysis,
  buildWorkflowTrace,
  clampScore,
  ensureAnalysisShape,
  getPublicEvidenceStatus,
} from "@/lib/market-pulse";
import { fetchWebsiteContext } from "@/lib/site-context";
import type {
  AnalysisRequest,
  AnalysisResponse,
  SourceReceipt,
  WebsiteContext,
  WorkflowStep,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_GEMINI_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanJsonResponse(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }

  return trimmed;
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "build",
  "building",
  "by",
  "can",
  "company",
  "for",
  "from",
  "help",
  "idea",
  "into",
  "is",
  "it",
  "launch",
  "market",
  "new",
  "not",
  "of",
  "on",
  "or",
  "product",
  "should",
  "signal",
  "signals",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "use",
  "using",
  "with",
  "your",
]);

function extractQueryTerms(input: AnalysisRequest) {
  const source = [input.businessQuestion, input.targetCustomer, input.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");

  const counts = new Map<string, number>();
  source
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
    .forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, 18);
}

function countMatches(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  let matches = 0;

  for (const term of terms) {
    if (normalized.includes(term)) matches += 1;
  }

  return matches;
}

function buildPrompt(input: AnalysisRequest, websiteContext: WebsiteContext) {
  const pageContext = websiteContext.pageSnapshots
    .slice(0, 4)
    .map((page, index) => {
      const summary = page.summary || page.description || "Not available";
      const headings = page.headings.join(" | ") || "Not available";
      return `Page ${index + 1}: ${page.url}
- Title: ${page.title || "Not available"}
- Description: ${page.description || "Not available"}
- Key headings: ${headings}
- Summary: ${summary}`;
    })
    .join("\n\n");

  return `You are Market Pulse Agent, a cautious market validation analyst for AI builders, founders, startup operators, GTM teams, and marketers.

Your task is to produce a directional public-signal read for whether an idea is worth testing.

Hard rules:
- This is NOT a poll.
- Do not call it a poll.
- Do not imply statistical certainty.
- Never say “the market wants this”.
- Use grounded language like: “Public signals suggest...”, “Based on available public evidence...”, “Directional read...”, “Evidence is mixed...”, “Worth testing...”.
- If evidence is weak, say so clearly.
- If the idea is broad, recommend a narrower wedge.
- Score the specific proposed wedge, not the company’s overall brand strength or AI trendiness.
- Always provide one practical next validation move.
- Never fabricate sources, links, company facts, customer quotes, case studies, or competitive claims.
- Do not use generic filler. Every section must reference the specific company, workflow, customer, or evidence in this run.
- If evidence is thin, say exactly what is missing instead of padding the answer with vague market language.
- If grounded public search is thin, keep the score conservative.
- If evidence is thin, do not sound high-confidence.
- Adoption Friction works in the negative direction: a higher score means more friction and should pull the overall score down.

Scoring logic:
- Demand Signal: 34%
- Pain Intensity: 26%
- Market Timing: 22%
- Adoption Friction: 18% negative weight
- Evidence Quality should visibly influence the final result and confidence language

Use these exact verdict options:
- Strongly worth testing
- Worth testing with a narrow wedge
- Mixed signal, validate before building
- Weak signal, reposition first
- Not enough public evidence

Use these exact workflow agents, in this exact order:
1. Website Context Agent
2. Public Signal Scout
3. Pain / Demand Cluster Agent
4. Skepticism & Risk Agent
5. Market Pulse Scoring Agent
6. Validation Move Agent

For nextValidationMove, choose the single best fit for this case from moves like:
- Landing page smoke test
- Concierge offer
- Outbound message test
- Pricing probe
- Demo-first pilot ask
- Channel-demand post
- Waitlist split test
- Customer interview sprint
Only choose Customer interview sprint when the biggest unknown is workflow truth and a more market-facing test would be misleading. Prefer sharper market-facing tests when the website context already suggests a clear wedge.

Output requirements:
- Return strict JSON only.
- marketPulseScore must be 0 to 100.
- marketPulseLabel must be one of: Weak Signal, Early Signal, Mixed Signal, Promising Signal, Strong Signal.
- shortSummary must explain the score in 2 to 3 tight sentences, including what pulled it up or down.
- verdictSentence must be a crisp executive verdict specific to this company and idea.
- bestWedge must name a narrow first segment, workflow, or use case.
- nextValidationMove must be concrete and operator-grade, something executable in 7 days or less.
- exampleCopy must be specific, such as a landing page headline, outreach message, LinkedIn angle, interview script, or demo opener.
- publicThemes must describe actual recurring themes from the evidence in this run, not generic market observations.
- positiveSignals and objections must be specific enough to guide a build or GTM decision.
- competitiveAlternatives should name real categories, incumbent tools, or current manual workarounds.
- sourceReceipts may be an empty array if no real public receipts are available. Do not invent URLs.
- evidenceLimitations must clearly explain what evidence was missing.
- workflowTrace notes should be compact.
- If evidence is limited, make that visible in the wording.
- Make the score, verdict, and shortSummary consistent with each other.

Decision questions to answer implicitly:
- Is this worth testing?
- What narrow wedge should be tested first?
- What objection could kill adoption?
- What should happen next, concretely?

User input:
Website URL: ${input.websiteUrl}
Business idea / question: ${input.businessQuestion}
Target customer: ${input.targetCustomer?.trim() || "Not provided"}
Notes: ${input.notes?.trim() || "Not provided"}

Website context gathered by the server:
- Resolved URL: ${websiteContext.resolvedUrl}
- Fetch succeeded: ${websiteContext.fetchSucceeded ? "Yes" : "No"}
- Fetched page count: ${websiteContext.fetchedPageCount}
- Homepage title: ${websiteContext.title || "Not available"}
- Homepage description: ${websiteContext.description || "Not available"}
- Homepage headings: ${websiteContext.headings.join(" | ") || "Not available"}
- Combined first-party summary: ${websiteContext.summary || "Not available"}
- Website limitation: ${websiteContext.limitation || "None"}

Additional first-party page context:
${pageContext || "Not available"}

Remember: this is a directional public-signal read, not a statistical survey.`;
}

function parseModelResponse(text: string): Partial<AnalysisResponse> {
  return JSON.parse(cleanJsonResponse(text)) as Partial<AnalysisResponse>;
}

function getGroundingUrls(groundingMetadata?: GroundingMetadata) {
  const urls = new Set<string>();

  groundingMetadata?.groundingChunks?.forEach((chunk) => {
    if (chunk.web?.uri) urls.add(chunk.web.uri);
    if (chunk.image?.sourceUri) urls.add(chunk.image.sourceUri);
  });

  return urls;
}

function toStrength(score: number): SourceReceipt["strength"] {
  if (score >= 0.75) return "High";
  if (score >= 0.45) return "Medium";
  return "Low";
}

function buildSourceReceipts(
  groundingMetadata: GroundingMetadata | undefined,
  websiteContext: WebsiteContext,
): SourceReceipt[] {
  const receipts = new Map<string, SourceReceipt>();
  const sourceNames = new Set<string>();

  groundingMetadata?.groundingSupports?.forEach((support) => {
    const claim = support.segment?.text?.trim();
    const chunkIndices = support.groundingChunkIndices ?? [];
    const averageConfidence =
      support.confidenceScores && support.confidenceScores.length > 0
        ? support.confidenceScores.reduce((sum, value) => sum + value, 0) /
          support.confidenceScores.length
        : 0.5;

    chunkIndices.forEach((chunkIndex) => {
      const chunk = groundingMetadata.groundingChunks?.[chunkIndex];
      const uri = chunk?.web?.uri || chunk?.image?.sourceUri;
      const title =
        chunk?.web?.title || chunk?.image?.title || (uri ? hostnameFromUrl(uri) : "");

      const normalizedTitle = title.toLowerCase();
      if (!uri || receipts.has(uri) || sourceNames.has(normalizedTitle)) return;

      receipts.set(uri, {
        sourceName: title,
        sourceUrl: uri,
        signal:
          claim ||
          "This source contributed directly to the grounded public web evidence used in the analysis.",
        whyItMatters:
          "It informed the directional read on demand, adoption risk, or category timing.",
        strength: toStrength(averageConfidence),
      });
      sourceNames.add(normalizedTitle);
    });
  });

  websiteContext.pageSnapshots.forEach((page) => {
    if (!page.url || receipts.has(page.url)) return;

    const signal = page.description || page.summary.slice(0, 220);
    const normalizedTitle = (page.title || hostnameFromUrl(page.url)).toLowerCase();
    if (!signal || sourceNames.has(normalizedTitle)) return;

    receipts.set(page.url, {
      sourceName: page.title || hostnameFromUrl(page.url),
      sourceUrl: page.url,
      signal,
      whyItMatters:
        page.url === websiteContext.resolvedUrl
          ? "The homepage anchors the company’s positioning, audience, and category language."
          : "This first-party page adds more specific evidence about product surfaces, use cases, or commercial framing.",
      strength: page.url === websiteContext.resolvedUrl ? "High" : "Medium",
    });
    sourceNames.add(normalizedTitle);
  });

  return Array.from(receipts.values()).slice(0, 6);
}

function deriveEvidenceQuality(
  input: AnalysisRequest,
  websiteContext: WebsiteContext,
  groundingMetadata: GroundingMetadata | undefined,
  searchAttempted: boolean,
  sourceReceipts: SourceReceipt[],
) {
  const groundedSourceCount = getGroundingUrls(groundingMetadata).size;
  const analyzedHostname = hostnameFromUrl(websiteContext.resolvedUrl);
  const externalSourceCount = sourceReceipts.filter(
    (receipt) =>
      receipt.sourceUrl && hostnameFromUrl(receipt.sourceUrl) !== analyzedHostname,
  ).length;
  const sourceDiversity = new Set(
    sourceReceipts
      .map((receipt) => {
        if (!receipt.sourceUrl) return "";
        return hostnameFromUrl(receipt.sourceUrl);
      })
      .filter(Boolean),
  ).size;
  const queryTerms = extractQueryTerms(input);
  const receiptSupportCount = sourceReceipts.filter((receipt) =>
    countMatches(`${receipt.signal} ${receipt.whyItMatters} ${receipt.sourceName}`, queryTerms) >= 2,
  ).length;

  let score = 0;

  if (websiteContext.fetchSucceeded) score += 10;
  score += Math.min(18, websiteContext.relevantPageCount * 6);
  score += Math.min(16, Math.round(websiteContext.averageRelevanceScore * 0.22));
  score += Math.min(14, Math.round(websiteContext.maxDirectSupportScore * 0.16));
  if (searchAttempted) score += 4;
  score += Math.min(18, groundedSourceCount * 6);
  score += Math.min(10, externalSourceCount * 3);
  score += Math.min(6, sourceDiversity * 2);
  score += Math.min(8, receiptSupportCount * 2);

  return clampScore(score);
}

function buildEvidenceLimitations(
  modelLimitations: string | undefined,
  websiteContext: WebsiteContext,
  groundedSourceCount: number,
  searchAttempted: boolean,
  groundingError?: string,
) {
  const notes = new Set<string>();

  if (websiteContext.limitation) notes.add(websiteContext.limitation);

  if (websiteContext.fetchSucceeded && groundedSourceCount === 0) {
    notes.add(
      websiteContext.fetchedPageCount > 1
        ? "Public web grounding was limited, so this read leans heavily on first-party website context and model reasoning."
        : "Evidence is limited mostly to homepage context and model reasoning.",
    );
  }

  if (!searchAttempted) {
    notes.add(
      "Grounded public web search was not available for this run, so confidence should stay directional rather than broad-market confident.",
    );
  } else if (groundedSourceCount === 0) {
    notes.add(
      groundingError
        ? `Grounded public search was limited: ${groundingError}`
        : "Grounded public search returned no traceable external receipts for this run.",
    );
  }

  if (modelLimitations?.trim()) notes.add(modelLimitations.trim());

  return Array.from(notes).join(" ");
}

function buildWorkflow(
  websiteContext: WebsiteContext,
  groundedSourceCount: number,
  evidenceQuality: number,
): WorkflowStep[] {
  const limitedSteps = new Set<string>();
  const notes: Partial<Record<(typeof AGENT_STEPS)[number], string>> = {
    "Website Context Agent": websiteContext.fetchSucceeded
      ? `Captured ${websiteContext.fetchedPageCount} first-party page${websiteContext.fetchedPageCount === 1 ? "" : "s"}, with ${websiteContext.relevantPageCount} relevant to the proposed wedge.`
      : "Website fetch was limited, so company context is partial.",
    "Public Signal Scout":
      groundedSourceCount > 0
        ? `Captured ${groundedSourceCount} grounded public source${groundedSourceCount === 1 ? "" : "s"}.`
        : "Traceable public web receipts were thin or unavailable.",
    "Pain / Demand Cluster Agent":
      evidenceQuality >= 55
        ? "Grouped recurring pain, demand, and urgency themes."
        : "Grouped directional themes, but confidence is limited by thin evidence.",
    "Skepticism & Risk Agent":
      "Surfaced objections, trust friction, and likely adoption blockers.",
    "Market Pulse Scoring Agent":
      "Converted live sub-scores plus evidence quality into the final pulse score.",
    "Validation Move Agent":
      "Recommended a concrete next test instead of generic advice.",
  };

  if (!websiteContext.fetchSucceeded) limitedSteps.add("Website Context Agent");
  if (groundedSourceCount === 0) limitedSteps.add("Public Signal Scout");
  if (evidenceQuality < 40) limitedSteps.add("Pain / Demand Cluster Agent");

  return buildWorkflowTrace(notes, limitedSteps);
}

function assertValidationMoveFit(result: Partial<AnalysisResponse>, websiteContext: WebsiteContext) {
  const moveType = result.nextValidationMove?.type?.trim().toLowerCase() || "";

  if (
    moveType === "customer interview sprint" &&
    websiteContext.relevantPageCount >= 3 &&
    websiteContext.averageRelevanceScore >= 28 &&
    websiteContext.maxDirectSupportScore >= 24
  ) {
    throw new Error(
      "Gemini returned an over-generic validation move. Choose a sharper market-facing test instead of customer interviews.",
    );
  }
}

async function generateWithRetries<T>(runner: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      return await runner();
    } catch (error) {
      lastError = error;

      if (attempt < MAX_GEMINI_ATTEMPTS) {
        await sleep(350 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed.");
}

async function generateStructuredAnalysis(
  input: AnalysisRequest,
  websiteContext: WebsiteContext,
) {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const contents = buildPrompt(input, websiteContext);

  let groundingError: string | undefined;

  try {
    const groundedResult = await generateWithRetries(async () => {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          temperature: 0.45,
          responseMimeType: "application/json",
          responseJsonSchema: analysisJsonSchema,
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = parseModelResponse(response.text || "{}");
      assertModelAnalysisShape(parsed);
      assertValidationMoveFit(parsed, websiteContext);

      return {
        parsed,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      };
    });

    return {
      ...groundedResult,
      searchAttempted: true,
      groundingError,
    };
  } catch (error) {
    groundingError = error instanceof Error ? error.message : "Unknown grounding error.";
  }

  const fallbackResult = await generateWithRetries(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        temperature: 0.45,
        responseMimeType: "application/json",
        responseJsonSchema: analysisJsonSchema,
      },
    });

    const parsed = parseModelResponse(response.text || "{}");
    assertModelAnalysisShape(parsed);
    assertValidationMoveFit(parsed, websiteContext);
    return parsed;
  });

  return {
    parsed: fallbackResult,
    groundingMetadata: undefined,
    searchAttempted: false,
    groundingError,
  };
}

function validateRequest(body: unknown): AnalysisRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const data = body as Record<string, unknown>;
  const websiteUrl = typeof data.websiteUrl === "string" ? data.websiteUrl.trim() : "";
  const businessQuestion =
    typeof data.businessQuestion === "string" ? data.businessQuestion.trim() : "";
  const targetCustomer =
    typeof data.targetCustomer === "string" ? data.targetCustomer.trim() : "";
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";

  if (!websiteUrl) throw new Error("Website URL is required.");
  if (!businessQuestion) throw new Error("Business idea / question is required.");

  return {
    websiteUrl,
    businessQuestion,
    targetCustomer,
    notes,
  };
}

export async function POST(request: Request) {
  try {
    const input = validateRequest(await request.json());
    const websiteContext = await fetchWebsiteContext(input);

    let parsed: Partial<AnalysisResponse>;
    let groundingMetadata: GroundingMetadata | undefined;
    let searchAttempted: boolean;
    let groundingError: string | undefined;

    try {
      ({ parsed, groundingMetadata, searchAttempted, groundingError } =
        await generateStructuredAnalysis(input, websiteContext));
    } catch (generationError) {
      if (!websiteContext.fetchSucceeded) {
        const minimal = buildMinimalNoEvidenceAnalysis(
          "We could not fetch usable website context or grounded public sources for this URL, so there is not enough public evidence to assess the proposed wedge.",
        );
        minimal.websiteContext = {
          title: websiteContext.title,
          description: websiteContext.description,
          summary: websiteContext.summary,
          resolvedUrl: websiteContext.resolvedUrl,
          fetchedPageCount: websiteContext.fetchedPageCount,
          relevantPageCount: websiteContext.relevantPageCount,
          averageRelevanceScore: websiteContext.averageRelevanceScore,
          maxDirectSupportScore: websiteContext.maxDirectSupportScore,
        };
        return NextResponse.json(minimal);
      }

      throw generationError;
    }

    const groundedSourceCount = getGroundingUrls(groundingMetadata).size;
    const sourceReceipts = buildSourceReceipts(groundingMetadata, websiteContext);
    const fallbackReceipts = buildFallbackReceipts({
      websiteUrl: websiteContext.resolvedUrl,
      title: websiteContext.title,
      description: websiteContext.description,
      summary: websiteContext.summary,
      pageSnapshots: websiteContext.pageSnapshots,
    });

    if (!websiteContext.fetchSucceeded && groundedSourceCount === 0) {
      const minimal = buildMinimalNoEvidenceAnalysis(
        "We could not fetch usable website context or grounded public sources for this URL, so there is not enough public evidence to assess the proposed wedge.",
      );
      minimal.websiteContext = {
        title: websiteContext.title,
        description: websiteContext.description,
        summary: websiteContext.summary,
        resolvedUrl: websiteContext.resolvedUrl,
        fetchedPageCount: websiteContext.fetchedPageCount,
        relevantPageCount: websiteContext.relevantPageCount,
        averageRelevanceScore: websiteContext.averageRelevanceScore,
        maxDirectSupportScore: websiteContext.maxDirectSupportScore,
      };
      return NextResponse.json(minimal);
    }

    const evidenceQuality = deriveEvidenceQuality(
      input,
      websiteContext,
      groundingMetadata,
      searchAttempted,
      sourceReceipts.length > 0 ? sourceReceipts : fallbackReceipts,
    );
    const publicEvidenceStatus = getPublicEvidenceStatus(
      evidenceQuality,
      groundedSourceCount,
      searchAttempted,
    );
    const workflowTrace = buildWorkflow(
      websiteContext,
      groundedSourceCount,
      evidenceQuality,
    );
    const evidenceLimitations = buildEvidenceLimitations(
      parsed.evidenceLimitations,
      websiteContext,
      groundedSourceCount,
      searchAttempted,
      groundingError,
    );

    const normalized = ensureAnalysisShape(parsed, {
      websiteUrl: websiteContext.resolvedUrl,
      evidenceQuality,
      publicEvidenceStatus,
      evidenceLimitations,
      workflowTrace,
      sourceReceipts: sourceReceipts.length > 0 ? sourceReceipts : fallbackReceipts,
      fetchedPageCount: websiteContext.fetchedPageCount,
      relevantPageCount: websiteContext.relevantPageCount,
      averageRelevanceScore: websiteContext.averageRelevanceScore,
      maxDirectSupportScore: websiteContext.maxDirectSupportScore,
      groundedSourceCount,
      hasWebsiteContext: websiteContext.fetchSucceeded,
    });

    normalized.websiteContext = {
      title: websiteContext.title,
      description: websiteContext.description,
      summary: websiteContext.summary,
      resolvedUrl: websiteContext.resolvedUrl,
      fetchedPageCount: websiteContext.fetchedPageCount,
      relevantPageCount: websiteContext.relevantPageCount,
      averageRelevanceScore: websiteContext.averageRelevanceScore,
      maxDirectSupportScore: websiteContext.maxDirectSupportScore,
    };
    normalized.workflowTrace = workflowTrace;
    normalized.sourceReceipts = sourceReceipts.length > 0 ? sourceReceipts : fallbackReceipts;
    normalized.evidenceLimitations = evidenceLimitations;
    normalized.publicEvidenceStatus = publicEvidenceStatus;
    normalized.evidenceQuality = evidenceQuality;

    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
