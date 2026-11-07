/** The AI's output shape, shared by the server (validation) and the client (rendering). */
export interface PillarRead {
  pillar: 1 | 2 | 3 | 4;
  applies: boolean;
  read: string;
}

export interface AnalysisResult {
  pillars: PillarRead[];
  bottom_line: string;
  safety_flag: boolean;
}

/** Gemini structured-output schema (OpenAPI subset). */
export const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pillars: {
      type: 'ARRAY',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'OBJECT',
        properties: {
          pillar: { type: 'INTEGER', minimum: 1, maximum: 4 },
          applies: { type: 'BOOLEAN' },
          read: { type: 'STRING' },
        },
        required: ['pillar', 'applies', 'read'],
        propertyOrdering: ['pillar', 'applies', 'read'],
      },
    },
    bottom_line: { type: 'STRING' },
    safety_flag: { type: 'BOOLEAN' },
  },
  required: ['pillars', 'bottom_line', 'safety_flag'],
  propertyOrdering: ['pillars', 'bottom_line', 'safety_flag'],
} as const;

/** Strict server-side check. Returns the result with pillars sorted 1-4, or null if anything is off. */
export function parseResult(raw: unknown): AnalysisResult | null {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.bottom_line !== 'string' || !d.bottom_line.trim()) return null;
  if (typeof d.safety_flag !== 'boolean') return null;
  if (!Array.isArray(d.pillars) || d.pillars.length !== 4) return null;
  const seen = new Set<number>();
  const pillars: PillarRead[] = [];
  for (const p of d.pillars) {
    if (!p || typeof p !== 'object') return null;
    const { pillar, applies, read } = p as Record<string, unknown>;
    if (pillar !== 1 && pillar !== 2 && pillar !== 3 && pillar !== 4) return null;
    if (seen.has(pillar)) return null;
    if (typeof applies !== 'boolean' || typeof read !== 'string' || !read.trim()) return null;
    seen.add(pillar);
    pillars.push({ pillar, applies, read: read.trim() });
  }
  pillars.sort((a, b) => a.pillar - b.pillar);
  return { pillars, bottom_line: d.bottom_line.trim(), safety_flag: d.safety_flag };
}
