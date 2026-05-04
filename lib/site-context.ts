import type { AnalysisRequest, WebsiteContext, WebsitePageSnapshot } from "@/lib/types";

const USER_AGENT =
  "Market Pulse Agent/0.1 (+https://vercel.com; public-signal research assistant)";

const PRIORITY_PATH_HINTS = [
  "ai",
  "product",
  "products",
  "pricing",
  "features",
  "feature",
  "solutions",
  "solution",
  "use-case",
  "use-cases",
  "enterprise",
  "marketing",
  "campaign",
  "campaigns",
  "developers",
  "developer",
  "platform",
  "apps",
  "customers",
  "why",
  "compare",
  "teams",
  "commerce",
  "growth",
  "automation",
  "security",
  "integrations",
  "sales",
];

const EXCLUDED_PATH_HINTS = [
  "domain",
  "domains",
  "register",
  "registration",
  "transfer",
  "login",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "cart",
  "checkout",
  "support",
  "help",
  "docs",
  "documentation",
  "legal",
  "privacy",
  "terms",
  "careers",
  "career",
  "press",
  "news",
  "contact",
  "status",
  "blog",
  "community",
  "forum",
  "forums",
];

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
  "campaign",
  "campaigns",
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
  "more",
  "new",
  "next",
  "not",
  "of",
  "on",
  "or",
  "our",
  "product",
  "should",
  "signal",
  "signals",
  "teams",
  "that",
  "the",
  "their",
  "them",
  "this",
  "through",
  "to",
  "use",
  "using",
  "want",
  "with",
  "your",
]);

function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("Website URL is required.");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

function stripTags(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function extractMetaDescription(html: string) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripTags(match[1]);
    }
  }

  return "";
}

function extractHeadings(html: string) {
  const matches = html.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) ?? [];
  return matches
    .map((heading) => stripTags(heading))
    .filter(Boolean)
    .slice(0, 8);
}

function extractSummary(html: string) {
  const mainContent = stripTags(html)
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 45)
    .slice(0, 12)
    .join(" ");

  return mainContent.slice(0, 1400);
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function buildQueryTerms(input: AnalysisRequest) {
  const source = [input.businessQuestion, input.targetCustomer, input.notes]
    .filter(Boolean)
    .join(" ");
  const counts = new Map<string, number>();

  tokenize(source).forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, 18);
}

function scoreTextMatch(text: string, queryTerms: string[]) {
  const normalized = text.toLowerCase();
  if (!normalized) return 0;

  let score = 0;
  for (const term of queryTerms) {
    if (normalized.includes(term)) {
      score += Math.min(10, Math.max(3, term.length));
    }
  }

  return score;
}

function shouldExcludePath(pathname: string) {
  const normalized = pathname.toLowerCase();
  return EXCLUDED_PATH_HINTS.some((hint) => normalized.includes(hint));
}

function scoreLink(pathname: string, anchorText: string, queryTerms: string[]) {
  const normalized = pathname.toLowerCase();
  let score = 0;

  PRIORITY_PATH_HINTS.forEach((hint) => {
    if (normalized.includes(hint)) score += 5;
  });

  score += scoreTextMatch(normalized.replace(/[/-]/g, " "), queryTerms) * 0.9;
  score += scoreTextMatch(anchorText, queryTerms) * 1.2;

  if (normalized === "/" || normalized.length <= 1) score -= 10;
  if (normalized.split("/").length <= 3) score += 1;

  return score;
}

function makeSnapshot(url: string, html: string, queryTerms: string[]): WebsitePageSnapshot {
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const headings = extractHeadings(html);
  const summary = extractSummary(html);
  const combined = [title, description, headings.join(" "), summary].filter(Boolean).join(" ");

  const relevanceScore = Math.min(100, Math.round(scoreTextMatch(combined, queryTerms) * 0.9));
  const directSupportScore = Math.min(
    100,
    Math.round(scoreTextMatch(`${title} ${description} ${headings.join(" ")}`, queryTerms) * 1.25),
  );

  return {
    url,
    title,
    description,
    headings,
    summary,
    relevanceScore,
    directSupportScore,
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(9000),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Website returned ${response.status} ${response.statusText}.`);
  }

  const html = await response.text();
  return {
    html,
    resolvedUrl: response.url || url,
  };
}

function extractPriorityInternalLinks(html: string, resolvedUrl: string, queryTerms: string[]) {
  const base = new URL(resolvedUrl);
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const links = new Map<string, number>();

  for (const match of matches) {
    const rawHref = match[1]?.trim();
    const anchorText = stripTags(match[2] || "");
    if (!rawHref) continue;
    if (rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) continue;

    try {
      const absolute = new URL(rawHref, base);
      if (absolute.origin !== base.origin) continue;
      if (shouldExcludePath(absolute.pathname)) continue;

      absolute.hash = "";
      absolute.search = "";
      const href = absolute.toString();
      if (href === resolvedUrl || href === `${resolvedUrl}/`) continue;

      const score = scoreLink(absolute.pathname, anchorText, queryTerms);
      if (score < 6) continue;

      links.set(href, Math.max(score, links.get(href) ?? Number.NEGATIVE_INFINITY));
    } catch {
      // ignore invalid links
    }
  }

  return Array.from(links.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([href]) => href)
    .slice(0, 4);
}

function buildCombinedSummary(snapshots: WebsitePageSnapshot[]) {
  const sections = snapshots
    .map((snapshot) => {
      const parts = [snapshot.title, snapshot.description, snapshot.summary]
        .filter(Boolean)
        .join(" ");
      return parts.trim();
    })
    .filter(Boolean)
    .join(" ");

  return sections.slice(0, 2600);
}

export async function fetchWebsiteContext(input: AnalysisRequest): Promise<WebsiteContext> {
  const normalizedUrl = normalizeUrl(input.websiteUrl);
  const queryTerms = buildQueryTerms(input);

  try {
    const homepage = await fetchHtml(normalizedUrl);
    const homepageSnapshot = makeSnapshot(homepage.resolvedUrl, homepage.html, queryTerms);
    const internalLinks = extractPriorityInternalLinks(
      homepage.html,
      homepage.resolvedUrl,
      queryTerms,
    );

    const additionalSnapshots = await Promise.all(
      internalLinks.map(async (link) => {
        try {
          const page = await fetchHtml(link);
          return makeSnapshot(page.resolvedUrl, page.html, queryTerms);
        } catch {
          return null;
        }
      }),
    );

    const additionalRelevantSnapshots = additionalSnapshots
      .filter((snapshot): snapshot is WebsitePageSnapshot => Boolean(snapshot))
      .filter((snapshot) => snapshot.relevanceScore >= 8 || snapshot.directSupportScore >= 10)
      .sort(
        (a, b) =>
          b.directSupportScore - a.directSupportScore || b.relevanceScore - a.relevanceScore,
      )
      .slice(0, 4);

    const pageSnapshots = [homepageSnapshot, ...additionalRelevantSnapshots];

    const summary = buildCombinedSummary(pageSnapshots);
    const fetchSucceeded = pageSnapshots.some(
      (snapshot) => snapshot.title || snapshot.description || snapshot.summary,
    );
    const relevantPageCount = pageSnapshots.filter((page) => page.relevanceScore >= 18).length;
    const averageRelevanceScore =
      pageSnapshots.length > 0
        ? Math.round(
            pageSnapshots.reduce((sum, page) => sum + page.relevanceScore, 0) /
              pageSnapshots.length,
          )
        : 0;
    const maxDirectSupportScore =
      pageSnapshots.reduce((max, page) => Math.max(max, page.directSupportScore), 0) || 0;

    return {
      requestedUrl: input.websiteUrl,
      resolvedUrl: homepage.resolvedUrl,
      title: homepageSnapshot.title,
      description: homepageSnapshot.description,
      headings: homepageSnapshot.headings,
      summary,
      fetchSucceeded,
      pageSnapshots,
      fetchedPageCount: pageSnapshots.length,
      relevantPageCount,
      averageRelevanceScore,
      maxDirectSupportScore,
      limitation:
        fetchSucceeded && pageSnapshots.length > 1
          ? undefined
          : fetchSucceeded
            ? "Only limited first-party website context could be gathered beyond the main page."
            : "The site loaded, but only limited readable context could be extracted."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error.";

    return {
      requestedUrl: input.websiteUrl,
      resolvedUrl: normalizedUrl,
      title: "",
      description: "",
      headings: [],
      summary: "",
      fetchSucceeded: false,
      pageSnapshots: [],
      fetchedPageCount: 0,
      relevantPageCount: 0,
      averageRelevanceScore: 0,
      maxDirectSupportScore: 0,
      limitation: `Website context fetch was limited: ${message}`,
    };
  }
}
