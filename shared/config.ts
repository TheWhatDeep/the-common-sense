/** App-wide settings. Each value is the single place to change that behavior. */
export const CONFIG = {
  /** Successful analyses per user per day. */
  dailyCap: 5,
  /** The daily count resets at midnight in this zone. */
  timeZone: 'Asia/Manila',
  situationMaxChars: 1000,
  noteMaxChars: 300,
  /** Fallback when the GEMINI_MODEL var is not set. */
  defaultGeminiModel: 'gemini-3.8-flash',
  geminiTimeoutMs: 20_000,
  sessionDays: 30,
} as const;
