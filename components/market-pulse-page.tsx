"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AGENT_STEPS,
  APP_NAME,
  SAMPLE_CASES,
  SUB_SCORE_META,
  TAGLINE,
  getEvidenceTone,
  getPulseAccent,
  getStrengthTone,
} from "@/lib/market-pulse";
import type { AnalysisRequest, AnalysisResponse, SampleCase, SubScoreKey } from "@/lib/types";

type FormState = AnalysisRequest;

const initialFormState: FormState = {
  websiteUrl: "",
  businessQuestion: "",
  targetCustomer: "",
  notes: "",
};

function Gauge({ result }: { result: AnalysisResponse }) {
  const accent = getPulseAccent(result.marketPulseScore);
  const degree = Math.max(8, Math.min(352, result.marketPulseScore * 3.6));

  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col items-center gap-5">
      <div
        className="gauge-shell relative flex h-72 w-72 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${accent} ${degree}deg, #e8edf4 ${degree}deg 360deg)`,
        }}
      >
        <div className="absolute inset-[15px] rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]" />
        <div className="absolute inset-[34px] rounded-full border border-[#edf1f5]" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6b7280]">
            Market Pulse
          </div>
          <div className="mt-3 text-7xl font-semibold tracking-[-0.05em] text-[#111827]">
            {result.marketPulseScore}
          </div>
          <div className="mt-3 text-sm font-medium text-[#4b5563]">{result.marketPulseLabel}</div>
        </div>
      </div>
      <div className="w-full overflow-hidden rounded-full bg-[#edf1f5]">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${result.marketPulseScore}%`, backgroundColor: accent }}
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-left">
        <div className="rounded-[22px] border border-[#e7ebf0] bg-[#fbfcfe] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
            Score label
          </div>
          <div className="mt-2 text-sm font-semibold text-[#111827]">{result.marketPulseLabel}</div>
        </div>
        <div className="rounded-[22px] border border-[#e7ebf0] bg-[#fbfcfe] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
            Evidence quality
          </div>
          <div className="mt-2 text-sm font-semibold text-[#111827]">{result.evidenceQuality}/100</div>
        </div>
      </div>
    </div>
  );
}

function SignalBreakdown({ result }: { result: AnalysisResponse }) {
  return (
    <section className="card-surface px-8 py-4">
      <div className="eyebrow">Signal Breakdown</div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(result.subScores) as SubScoreKey[]).map((key) => {
          const item = result.subScores[key];
          const meta = SUB_SCORE_META[key];
          return (
            <article
              key={key}
              className="rounded-[28px] border border-[#e8ebf0] bg-[#fbfcfe] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="text-sm font-medium text-[#111827]">{meta.label}</div>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">{meta.description}</p>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-[#111827]">
                {item.score}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e8edf4]">
                <div
                  className="h-full rounded-full bg-[#5e8fff] transition-all duration-500"
                  style={{ width: `${item.score}%` }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4b5563]">{item.explanation}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface px-8 py-4">
      <h3 className="text-2xl font-semibold tracking-tight text-[#111827]">{title}</h3>
      <div className="mt-5 text-[15px] leading-7 text-[#374151]">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#111827]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e7ebf0] bg-[#fbfcfe] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
        {label}
      </div>
      <div className={`mt-3 text-sm font-semibold ${tone || "text-[#111827]"}`}>{value}</div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

function WorkflowTracePanel({
  isLoading,
  stepIndex,
  progress,
}: {
  isLoading: boolean;
  stepIndex: number;
  progress: number;
}) {
  return (
    <div className="rounded-[28px] border border-[#e7ebf0] bg-white/92 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-5">
      <div className="eyebrow">Compact agent workflow trace</div>
      <div className="mt-3 flex flex-col gap-2">
        {AGENT_STEPS.map((step, index) => {
          const isCompleted = isLoading && index < stepIndex;
          const isActive = isLoading && index === stepIndex;
          const isPending = isLoading && index > stepIndex;

          return (
            <div
              key={step}
              className="rounded-[20px] border border-[#e7ebf0] bg-[#fbfcfe] px-3.5 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-5 text-[#111827]">{step}</div>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    isCompleted
                      ? "bg-[#ecfdf3] text-[#027a48]"
                      : isActive
                        ? "bg-[#eef7ff] text-[#0071e3]"
                        : isPending
                          ? "bg-[#f8fafc] text-[#94a3b8]"
                          : "bg-[#f3f4f6] text-[#6b7280]"
                  }`}
                >
                  {isCompleted ? (
                    "Done"
                  ) : isActive ? (
                    <>
                      <span>Running {progress}%</span>
                      <LoadingDots />
                    </>
                  ) : isPending ? (
                    "Waiting"
                  ) : (
                    "Ready"
                  )}
                </div>
              </div>
              {isActive ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]">
                  <div
                    className="h-full rounded-full bg-[#5e8fff] transition-[width] duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MarketPulsePage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [pendingResult, setPendingResult] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestFinished, setRequestFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState({
    stepIndex: 0,
    progress: 0,
  });
  const formRef = useRef<FormState>(initialFormState);
  const requestIdRef = useRef(0);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const pendingResultRef = useRef<AnalysisResponse | null>(null);
  const requestFinishedRef = useRef(false);

  useEffect(() => {
    pendingResultRef.current = pendingResult;
  }, [pendingResult]);

  useEffect(() => {
    requestFinishedRef.current = requestFinished;
  }, [requestFinished]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingState({ stepIndex: 0, progress: 0 });
      return;
    }

    setLoadingState({ stepIndex: 0, progress: 0 });

    const lastStepIndex = AGENT_STEPS.length - 1;
    const interval = window.setInterval(() => {
      setLoadingState((current) => {
        const isLastStep = current.stepIndex >= lastStepIndex;
        const canFinishLastStep = Boolean(
          requestFinishedRef.current && pendingResultRef.current,
        );
        const maxProgress = isLastStep ? (canFinishLastStep ? 100 : 99) : 100;

        if (current.progress >= maxProgress) {
          if (isLastStep) {
            return { stepIndex: current.stepIndex, progress: maxProgress };
          }

          return { stepIndex: current.stepIndex + 1, progress: 0 };
        }

        return {
          stepIndex: current.stepIndex,
          progress: Math.min(current.progress + 8, maxProgress),
        };
      });
    }, 90);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const workflowComplete =
    loadingState.stepIndex === AGENT_STEPS.length - 1 && loadingState.progress >= 100;

  const canSubmit = useMemo(
    () => Boolean(form.websiteUrl.trim() && form.businessQuestion.trim()) && !isLoading,
    [form.businessQuestion, form.websiteUrl, isLoading],
  );

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      formRef.current = next;
      return next;
    });
  }

  function applySample(sample: SampleCase) {
    const nextForm = {
      websiteUrl: sample.websiteUrl,
      businessQuestion: `${sample.businessQuestion}\n\nTarget customer: ${sample.targetCustomer}`,
      targetCustomer: "",
      notes: sample.notes || "",
    };

    formRef.current = nextForm;
    setForm(nextForm);
    setError(null);
  }

  useEffect(() => {
    if (!isLoading || !requestFinished || !pendingResult || !workflowComplete) {
      return;
    }

    setResult(pendingResult);
    setPendingResult(null);
    setIsLoading(false);
    setRequestFinished(false);

    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [isLoading, pendingResult, requestFinished, workflowComplete]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitForm = formRef.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setRequestFinished(false);
    setPendingResult(null);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitForm),
      });

      const payload = (await response.json()) as AnalysisResponse & { error?: string };

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to analyze this market pulse right now.");
      }

      setPendingResult(payload);
      setRequestFinished(true);
    } catch (submitError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while checking the market pulse.",
      );
      setPendingResult(null);
      setRequestFinished(false);
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-[10px] px-6 pb-20 pt-6 md:px-10 lg:px-12 lg:pt-8">
        <section className="hero-surface overflow-hidden rounded-[40px] border border-[#e7ebf0] px-8 py-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:px-12 md:py-5">
          <div className="max-w-5xl">
            <div className="eyebrow">{APP_NAME}</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[#111827] md:text-6xl">
              {TAGLINE}
            </h1>
            <p className="mt-5 max-w-4xl text-xl leading-8 text-[#374151] md:text-2xl">
              Most builders do not need more ideas. They need a faster way to know
              which ideas deserve a real test. Built for AI builders, founders,
              and startup operators validating ideas before they overbuild.
            </p>
            <p className="mt-4 max-w-4xl text-lg leading-8 text-[#6b7280]">
              Stop building into silence. Run a fast public-signal read before you
              commit time, budget, or reputation. Also useful for GTM teams,
              product marketers, agencies, and early-stage startup teams running
              idea validation before launch.
            </p>
          </div>
        </section>

        <section>
          <div className="card-surface px-7 py-4 md:px-8 md:py-4 lg:px-9 lg:py-5">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:items-start">
              <div className="flex h-full flex-col">
                <div>
                  <div className="eyebrow">Check Market Pulse</div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280]">
                    Anchor the read to a real company or product website, then test a narrow business question before you commit build time.
                  </p>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#374151]">Website URL</span>
                    <input
                      className="field-input"
                      value={form.websiteUrl}
                      onChange={(event) => updateField("websiteUrl", event.target.value)}
                    />
                    <p className="text-sm leading-6 text-[#6b7280]">
                      Enter the company or product homepage you want to anchor the read on.
                    </p>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#374151]">Business idea / question</span>
                    <textarea
                      className="field-input h-[60px] resize-none overflow-y-scroll"
                      value={form.businessQuestion}
                      onChange={(event) => updateField("businessQuestion", event.target.value)}
                    />
                    <p className="text-sm leading-6 text-[#6b7280]">
                      State the wedge you want judged. If the buyer matters, include the target customer directly in the text.
                    </p>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#374151]">Notes (optional)</span>
                    <textarea
                      className="field-input h-[48px] resize-none overflow-y-scroll"
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                    />
                    <p className="text-sm leading-6 text-[#6b7280]">
                      Add pricing context, GTM constraints, or the exact trigger you think makes the idea timely.
                    </p>
                  </label>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button type="submit" disabled={!canSubmit} className="primary-button">
                      {isLoading ? "Checking pulse..." : "Check Market Pulse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        requestIdRef.current += 1;
                        formRef.current = initialFormState;
                        setForm(initialFormState);
                        setResult(null);
                        setPendingResult(null);
                        setRequestFinished(false);
                        setIsLoading(false);
                        setError(null);
                      }}
                      className="secondary-button"
                    >
                      Reset
                    </button>
                  </div>
                </form>

                {error ? (
                  <div className="mt-4 rounded-[24px] border border-[#ffd6d3] bg-[#fff5f4] px-5 py-4 text-sm text-[#b42318]">
                    {error}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                  Try a sample pulse
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                  {SAMPLE_CASES.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => applySample(sample)}
                      className="rounded-[18px] border border-[#dbe1e8] bg-[#fbfcfe] px-4 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#c9d4e2] hover:bg-white"
                    >
                      <div className="text-sm font-semibold text-[#111827]">{sample.name}</div>
                      <div className="mt-0.5 text-xs leading-4.5 text-[#6b7280]">
                        {sample.compactDescription}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <WorkflowTracePanel
                    isLoading={isLoading}
                    stepIndex={loadingState.stepIndex}
                    progress={loadingState.progress}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {result ? (
          <div ref={resultRef} className="space-y-[10px]">
            <section className="card-surface px-8 py-4 md:px-10 md:py-5">
              <div className="space-y-[10px]">
                <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                  <Gauge result={result} />

                  <div className="space-y-3">
                    <div>
                      <div className="eyebrow">Executive Verdict</div>
                      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#111827] md:text-4xl">
                        {result.verdict}
                      </h2>
                      <p className="mt-4 text-lg leading-8 text-[#4b5563]">{result.verdictSentence}</p>
                    </div>

                    <div className="inline-flex items-center rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-[#4b5563] ring-1 ring-[#e5e7eb]">
                      This is a directional public-signal read, not a statistical survey.
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <SummaryMetric label="Why this score" value={result.shortSummary} />
                      {result.bestWedge ? (
                        <SummaryMetric label="Best wedge" value={result.bestWedge} />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                  <div className="rounded-[24px] border border-[#e7ebf0] bg-[#fbfcfe] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                      Public evidence status
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getEvidenceTone(result.publicEvidenceStatus)}`}
                      >
                        {result.publicEvidenceStatus}
                      </span>
                      <span className="text-sm font-semibold text-[#111827]">
                        Evidence quality {result.evidenceQuality}/100
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#4b5563]">
                      {result.evidenceLimitations}
                    </p>
                  </div>

                  <div className="rounded-[28px] bg-[#f7f9fc] p-6 ring-1 ring-[#e5e7eb]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">
                      {result.nextValidationMove.type}
                    </div>
                    <p className="mt-4 text-base leading-7 text-[#111827]">
                      {result.nextValidationMove.recommendation}
                    </p>
                    <div className="mt-5 rounded-[22px] bg-white p-4 text-sm leading-6 whitespace-pre-wrap text-[#4b5563] ring-1 ring-[#e5e7eb]">
                      {result.nextValidationMove.exampleCopy}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {result.evidenceQuality > 0 ? <SignalBreakdown result={result} /> : null}

            {result.publicThemes.length > 0 ? (
              <SectionCard title="What the public market is saying">
                <div className="grid gap-4 lg:grid-cols-2">
                  {result.publicThemes.map((theme, index) => (
                    <article
                      key={`${theme.theme}-${index}`}
                      className="rounded-[28px] border border-[#e7ebf0] bg-[#fbfcfe] p-5"
                    >
                      <div className="text-lg font-semibold text-[#111827]">{theme.theme}</div>
                      <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                        {theme.whatPeopleAreSaying}
                      </p>
                      <div className="mt-4 border-t border-[#e7ebf0] pt-4 text-sm leading-6 text-[#374151]">
                        {theme.whyItMatters}
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {result.positiveSignals.length > 0 ? (
              <SectionCard title="Positive demand signals">
                <BulletList items={result.positiveSignals} />
              </SectionCard>
            ) : null}

            {result.objections.length > 0 ? (
              <SectionCard title="Objections / skepticism">
                <BulletList items={result.objections} />
              </SectionCard>
            ) : null}

            {result.competitiveAlternatives.length > 0 ? (
              <SectionCard title="Competitive alternatives">
                <BulletList items={result.competitiveAlternatives} />
              </SectionCard>
            ) : null}

            {result.sourceReceipts.length > 0 ? (
              <SectionCard title="Source receipts">
                <div className="grid gap-4 lg:grid-cols-2">
                  {result.sourceReceipts.map((receipt, index) => (
                    <article
                      key={`${receipt.sourceName}-${receipt.sourceUrl || index}`}
                      className="rounded-[28px] border border-[#e7ebf0] bg-[#fbfcfe] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-lg font-semibold text-[#111827]">{receipt.sourceName}</div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStrengthTone(receipt.strength)}`}
                        >
                          {receipt.strength}
                        </span>
                      </div>
                      {receipt.sourceUrl ? (
                        <a
                          href={receipt.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block truncate text-sm text-[#0071e3] hover:underline"
                        >
                          {receipt.sourceUrl}
                        </a>
                      ) : null}
                      <div className="mt-4 text-sm font-medium text-[#111827]">Signal found</div>
                      <p className="mt-1 text-sm leading-6 text-[#4b5563]">{receipt.signal}</p>
                      <div className="mt-4 text-sm font-medium text-[#111827]">Why it matters</div>
                      <p className="mt-1 text-sm leading-6 text-[#4b5563]">{receipt.whyItMatters}</p>
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
