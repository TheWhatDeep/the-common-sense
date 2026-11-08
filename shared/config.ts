/** App-wide settings. Each value is the single place to change that behavior. */
export const CONFIG = {
  /** Successful analyses per user per day. */
  dailyCap: 5,
  /** The daily count resets at midnight in this zone. */
  timeZone: 'Asia/Manila',
  situationMaxChars: 1000,
  noteMaxChars: 300,
  /** Fallback when the GEMINI_MODEL var is not set. */
  defaultGeminiModel: 'gemini-3.6-flash',
  /** Streaming: give up if Gemini sends nothing for this long. */
  geminiIdleTimeoutMs: 30_000,
  /** Streaming: hard cap on one Gemini call, however chatty it is. */
  geminiTotalTimeoutMs: 120_000,
  sessionDays: 30,
} as const;
