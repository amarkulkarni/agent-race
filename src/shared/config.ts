/** Change model here — single source of truth */
export const MODEL = 'claude-sonnet-4-20250514'

/** USD per token — update when MODEL pricing changes */
export const COST_PER_INPUT_TOKEN = 3 / 1_000_000
export const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN
}
