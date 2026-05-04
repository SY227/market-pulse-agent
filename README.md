# Market Pulse Agent

Before you build it, check the market pulse.

Market Pulse Agent is a Next.js demo for AI builders, founders, and startup operators validating ideas before they overbuild. A user enters a website plus a business idea or question, and the app returns a directional public-signal read with a Market Pulse score, objections, best wedge, and next validation move.

## What the app does

- Anchors the analysis to a real company or product website
- Pulls lightweight website context on the server
- Tries grounded public web search through Gemini when available
- Returns a structured market read, not a generic chat answer
- Surfaces:
  - Market Pulse score
  - score label
  - executive verdict
  - why this score
  - best wedge
  - next validation move
  - signal breakdown
  - demand signals and objections
  - competitive alternatives
  - source receipts
  - evidence limitations
  - compact workflow trace

## Why this is directional, not a poll

This product is intentionally cautious.

It does **not** run a survey, collect a representative sample, or claim statistical certainty. It reads public signals from the website context and, when available, grounded public web results. The output should be treated as a directional market read that helps a team decide whether an idea deserves a sharper real-world test.

If public evidence is thin, the app explicitly says so and dampens the final score.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Gemini 2.5 Flash Lite via `@google/genai`
- App Router API route
- Vercel-ready deployment

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env.local`

Create a file named `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The app uses `GEMINI_API_KEY` on the server and targets:

- `gemini-2.5-flash-lite`

### 3) Start the dev server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Checks

Run type checking:

```bash
npm run typecheck
```

Run a production build:

```bash
npm run build
```

## Vercel deployment notes

- Import the repository into Vercel as a standard Next.js project.
- Add `GEMINI_API_KEY` in the Vercel project environment variables.
- Redeploy after adding or changing environment variables.
- The API key is only read on the server.
- If grounded Google Search support is limited or unavailable in a run, the app still returns a result but clearly marks the evidence as limited.

## Security note

- Do **not** commit `.env.local`.
- Do **not** commit secrets, API keys, or private credentials.
- Keep `GEMINI_API_KEY` in local or platform-managed environment variables only.

## Notes

- Source receipts are only shown when a real source URL exists.
- If the app only has website context, it says so instead of pretending public research happened.
- The output is designed to be decision-useful, but it should still be followed by real customer validation.
