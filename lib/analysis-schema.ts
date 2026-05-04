export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "marketPulseScore",
    "marketPulseLabel",
    "verdict",
    "shortSummary",
    "verdictSentence",
    "subScores",
    "publicThemes",
    "positiveSignals",
    "objections",
    "competitiveAlternatives",
    "bestWedge",
    "nextValidationMove",
    "sourceReceipts",
    "evidenceLimitations",
    "workflowTrace",
    "evidenceQuality",
  ],
  properties: {
    marketPulseScore: { type: "number", minimum: 0, maximum: 100 },
    marketPulseLabel: { type: "string" },
    verdict: { type: "string" },
    shortSummary: { type: "string" },
    verdictSentence: { type: "string" },
    evidenceQuality: { type: "number", minimum: 0, maximum: 100 },
    subScores: {
      type: "object",
      additionalProperties: false,
      required: [
        "demandSignal",
        "painIntensity",
        "marketTiming",
        "adoptionFriction",
      ],
      properties: {
        demandSignal: {
          type: "object",
          additionalProperties: false,
          required: ["score", "explanation"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
          },
        },
        painIntensity: {
          type: "object",
          additionalProperties: false,
          required: ["score", "explanation"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
          },
        },
        marketTiming: {
          type: "object",
          additionalProperties: false,
          required: ["score", "explanation"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
          },
        },
        adoptionFriction: {
          type: "object",
          additionalProperties: false,
          required: ["score", "explanation"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
          },
        },
      },
    },
    publicThemes: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["theme", "whatPeopleAreSaying", "whyItMatters"],
        properties: {
          theme: { type: "string" },
          whatPeopleAreSaying: { type: "string" },
          whyItMatters: { type: "string" },
        },
      },
    },
    positiveSignals: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    objections: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    competitiveAlternatives: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    bestWedge: { type: "string" },
    nextValidationMove: {
      type: "object",
      additionalProperties: false,
      required: ["type", "recommendation", "exampleCopy"],
      properties: {
        type: { type: "string" },
        recommendation: { type: "string" },
        exampleCopy: { type: "string" },
      },
    },
    sourceReceipts: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceName", "signal", "whyItMatters", "strength"],
        properties: {
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          signal: { type: "string" },
          whyItMatters: { type: "string" },
          strength: { type: "string", enum: ["High", "Medium", "Low"] },
        },
      },
    },
    evidenceLimitations: { type: "string" },
    workflowTrace: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["agent", "note", "status"],
        properties: {
          agent: { type: "string" },
          note: { type: "string" },
          status: { type: "string", enum: ["done", "limited"] },
        },
      },
    },
  },
} as const;
