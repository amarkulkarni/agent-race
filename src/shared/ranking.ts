import type { AgentState } from './types'

export interface RankingResult {
  /** True once no agent is still running/idle — the ranking is final. */
  settled: boolean
  /** agentId of the winner, or null when not settled or nobody produced a diff. */
  winnerId: number | null
  /** 1-based rank keyed by agentId, for agents that produced a usable diff. */
  rankById: Record<number, number>
}

/** An agent can be ranked only if it finished and produced a non-empty diff. */
function isRankable(agent: AgentState): boolean {
  return agent.status === 'done' && agent.diff.trim().length > 0
}

/**
 * Ordering for rankable agents — lower is better: cheapest wins, ties broken
 * by faster latency, then smaller diff.
 *
 * NOTE: this is a cost/speed heuristic with no correctness signal yet. A
 * cheap-but-wrong diff can outrank a pricier correct one. Adding a test-runner
 * tool (pass/fail per worktree) is the intended way to give this real teeth.
 */
function compareRankable(a: AgentState, b: AgentState): number {
  if (a.cost !== b.cost) return a.cost - b.cost
  if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
  return a.diff.length - b.diff.length
}

export function rankAgents(agents: AgentState[]): RankingResult {
  const settled =
    agents.length > 0 && agents.every((a) => a.status === 'done' || a.status === 'failed')

  const ranked = agents.filter(isRankable).sort(compareRankable)

  const rankById: Record<number, number> = {}
  ranked.forEach((agent, index) => {
    rankById[agent.agentId] = index + 1
  })

  const winnerId = settled && ranked.length > 0 ? ranked[0].agentId : null

  return { settled, winnerId, rankById }
}
