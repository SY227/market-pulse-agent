export function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local before running Market Pulse Agent.",
    );
  }

  return apiKey;
}
