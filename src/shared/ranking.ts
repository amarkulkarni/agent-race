import type { AgentState } from './types'

export interface RankingResult {
  /** True once no agent is still running and no tests are still running — ranking is final. */
  settled: boolean
  /** agentId of the winner, or null when not settled, nobody produced a diff, or the best diff failed tests. */
  winnerId: number | null
  /** 1-based rank keyed by agentId, for agents that produced a usable diff. */
  rankById: Record<number, number>
}

/** An agent can be ranked only if it finished and produced a non-empty diff. */
function isRankable(agent: AgentState): boolean {
  return agent.status === 'done' && agent.diff.trim().length > 0
}

/**
 * Lower is better. Test outcome dominates: a passing diff always beats an
 * untested one, which beats a failing one. When test outcome ties (including
 * when no test command was given, so everyone is 'none'), fall back to cheapest,
 * then faster, then smaller diff.
 */
function testRank(agent: AgentState): number {
  if (agent.testStatus === 'passed') return 0
  if (agent.testStatus === 'failed') return 2
  return 1 // 'none' / 'running' — no usable signal
}

function compareRankable(a: AgentState, b: AgentState): number {
  if (testRank(a) !== testRank(b)) return testRank(a) - testRank(b)
  if (a.cost !== b.cost) return a.cost - b.cost
  if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
  return a.diff.length - b.diff.length
}

export function rankAgents(agents: AgentState[]): RankingResult {
  const settled =
    agents.length > 0 &&
    agents.every(
      (a) => (a.status === 'done' || a.status === 'failed') && a.testStatus !== 'running'
    )

  const ranked = agents.filter(isRankable).sort(compareRankable)

  const rankById: Record<number, number> = {}
  ranked.forEach((agent, index) => {
    rankById[agent.agentId] = index + 1
  })

  // The top-ranked agent wins — unless it failed its tests (i.e. every agent
  // that produced a diff failed), in which case there is no clean winner.
  const top = ranked[0]
  const winnerId = settled && top && top.testStatus !== 'failed' ? top.agentId : null

  return { settled, winnerId, rankById }
}
