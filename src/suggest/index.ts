import { rulesProvider } from './rules'
import type { Suggestion, SuggestionContext, SuggestionProvider } from './types'

/**
 * Active providers. To add AI ideas:
 *   import { createLlmProvider, httpLlmClient } from './llm'
 *   export const PROVIDERS = [rulesProvider, createLlmProvider(httpLlmClient('/api/llm'))]
 */
export const PROVIDERS: SuggestionProvider[] = [rulesProvider]

export async function collectSuggestions(
  ctx: SuggestionContext,
  providers: SuggestionProvider[] = PROVIDERS,
): Promise<Suggestion[]> {
  const results = await Promise.allSettled(providers.map((p) => Promise.resolve(p.suggest(ctx))))
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

export type { Suggestion, SuggestionContext, SuggestionKind, SuggestionProvider } from './types'
