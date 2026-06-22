import type { ReactElement } from 'react'
import DiffView from './DiffView'
import type { AgentState, TestStatus } from '@shared/types'

interface AgentCardProps {
  agent: AgentState
  /** 1-based rank once the race has settled; undefined while running or if unranked. */
  rank?: number
  isWinner?: boolean
}

const TEST_BADGE_LABEL: Record<TestStatus, string> = {
  none: '',
  running: 'testing…',
  passed: 'tests ✓',
  failed: 'tests ✗'
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function liveLatency(agent: AgentState): number {
  if (agent.status === 'running' && agent.startedAt) {
    return Date.now() - agent.startedAt
  }
  return agent.latencyMs
}

export default function AgentCard({ agent, rank, isWinner }: AgentCardProps): ReactElement {
  const statusClass = `agent-card agent-card--${agent.status}${isWinner ? ' agent-card--winner' : ''}`

  return (
    <div className={statusClass}>
      <div className="agent-card__header">
        <h3>Agent {agent.agentId}</h3>
        <div className="agent-card__badges">
          {rank !== undefined && (
            <span className={`rank-badge${isWinner ? ' rank-badge--winner' : ''}`}>
              {isWinner ? '🏆 Winner' : `#${rank}`}
            </span>
          )}
          {agent.testStatus !== 'none' && (
            <span className={`test-badge test-badge--${agent.testStatus}`}>
              {TEST_BADGE_LABEL[agent.testStatus]}
            </span>
          )}
          <span className={`status-badge status-badge--${agent.status}`}>{agent.status}</span>
        </div>
      </div>

      {agent.worktreePath && (
        <p className="agent-card__meta" title={agent.worktreePath}>
          {agent.worktreePath}
        </p>
      )}

      <div className="agent-card__stats">
        <span>Latency: {formatLatency(liveLatency(agent))}</span>
        <span>Tokens: {agent.inputTokens + agent.outputTokens}</span>
        <span>Cost: {formatCost(agent.cost)}</span>
      </div>

      {agent.error && <p className="agent-card__error">{agent.error}</p>}

      {agent.testStatus === 'failed' && agent.testOutput && (
        <div className="agent-card__test-output">
          <h4>Test output</h4>
          <pre className="stream-output">{agent.testOutput}</pre>
        </div>
      )}

      {agent.output && (
        <div className="agent-card__stream">
          <h4>Live output</h4>
          <pre className="stream-output">{agent.output}</pre>
        </div>
      )}

      {(agent.status === 'done' || agent.diff) && (
        <div className="agent-card__diff">
          <h4>Diff</h4>
          <DiffView diff={agent.diff} />
        </div>
      )}
    </div>
  )
}
