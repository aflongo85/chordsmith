/**
 * Optional AI layer — NOT enabled by default.
 *
 * The LLM never sees raw audio or free text only: it receives the structured analysis produced
 * by the theory engine, and everything it returns is re-validated (chord symbols must parse,
 * notes must parse) before it reaches the UI.
 *
 * To enable it:
 *   1. run a small backend that holds the API key and forwards { system, prompt } to the model
 *      (never put an API key in browser code);
 *   2. in suggest/index.ts add `createLlmProvider(httpLlmClient('/api/llm'))` to the providers.
 */
import { parseChord } from '../core/chords'
import { formatMelody, parseMelody } from '../core/melody'
import { SCALES } from '../core/scales'
import type { Suggestion, SuggestionContext, SuggestionKind, SuggestionProvider } from './types'

export interface LlmRequest {
  system: string
  prompt: string
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<string>
}

/** Client for a backend proxy that returns { text: string }. */
export function httpLlmClient(endpoint: string): LlmClient {
  return {
    async complete(req) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) throw new Error(`LLM proxy error ${res.status}`)
      const data = (await res.json()) as { text?: string }
      return data.text ?? ''
    },
  }
}

const KINDS: SuggestionKind[] = ['prossimo accordo', 'sostituzione', 'variazione', 'nuova sezione', 'sviluppo melodico', 'consiglio']

export function buildPrompt(ctx: SuggestionContext): LlmRequest {
  const p = ctx.progression
  const m = ctx.melody
  const summary = {
    genere: ctx.genre.name,
    strumento: `${ctx.instrument.name} (${ctx.tuning.name})`,
    progressione: p && {
      accordi: p.chords.map((c) => c.symbol),
      tonalita: p.key.label,
      gradi: p.items.map((i) => i.roman),
      categorie: p.items.map((i) => i.category),
      schemi: p.patterns.map((x) => x.template.name),
      osservazioni: p.observations,
    },
    melodia: m && ctx.melodyNotes && {
      note: formatMelody(ctx.melodyNotes, m.key.names),
      tonalita: m.key.label,
      scale: m.scaleFits.map((f) => `${f.tonic} ${SCALES[f.scale].label}`),
      osservazioni: m.observations,
    },
  }
  return {
    system:
      `Sei un compositore e arrangiatore esperto di ${ctx.genre.name}. Rispondi SOLO con un array JSON. ` +
      `Ogni elemento: {"kind": uno di ${JSON.stringify(KINDS)}, "title": string, "description": string (italiano, max 2 frasi), ` +
      `"chords"?: string[] (simboli tipo "Am", "Fmaj7", "D5"), "melody"?: string (note tipo "E2 G2/8 A2/8")}.`,
    prompt: `Analisi del materiale:\n${JSON.stringify(summary, null, 2)}\n\nProponi 5 idee creative per sviluppare questo materiale.`,
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
}

export function createLlmProvider(client: LlmClient): SuggestionProvider {
  return {
    id: 'llm',
    name: 'AI',
    async suggest(ctx) {
      const raw = extractJson(await client.complete(buildPrompt(ctx)))
      if (!Array.isArray(raw)) return []
      return raw.flatMap((r, i): Suggestion[] => {
        if (typeof r !== 'object' || r === null) return []
        const o = r as Record<string, unknown>
        const kind = KINDS.includes(o.kind as SuggestionKind) ? (o.kind as SuggestionKind) : 'consiglio'
        const chords = Array.isArray(o.chords) ? o.chords.filter((c): c is string => typeof c === 'string' && parseChord(c) !== null) : undefined
        const parsedMelody = typeof o.melody === 'string' ? parseMelody(o.melody, ctx.instrument, ctx.tuning) : null
        const melody = parsedMelody && parsedMelody.errors.length === 0 ? parsedMelody.notes : undefined
        if (typeof o.title !== 'string') return []
        return [{
          id: `llm-${i}`,
          kind,
          title: o.title,
          description: typeof o.description === 'string' ? o.description : '',
          chords: chords?.length ? chords : undefined,
          melody,
          score: 0.7,
          source: 'llm',
        }]
      })
    },
  }
}
