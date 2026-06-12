import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import AgentCard from './AgentCard'
import { estimateCost } from '@shared/config'
import { createInitialAgentState, type AgentEvent, type AgentState } from '@shared/types'
import './App.css'

export default function App(): ReactElement {
  const [repoPath, setRepoPath] = useState('')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [agentCount, setAgentCount] = useState(3)
  const [agents, setAgents] = useState<AgentState[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const totalCost = useMemo(
    () => agents.reduce((sum, a) => sum + a.cost, 0),
    [agents]
  )

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    setAgents((prev) => {
      const next = [...prev]
      let agent = next.find((a) => a.agentId === event.agentId)
      if (!agent) {
        agent = createInitialAgentState(event.agentId)
        next.push(agent)
      }

      const idx = next.findIndex((a) => a.agentId === event.agentId)
      const updated = { ...agent }

      switch (event.type) {
        case 'started':
          updated.status = 'running'
          updated.worktreePath = event.worktreePath
          updated.startedAt = Date.now()
          updated.output = ''
          updated.diff = ''
          updated.error = null
          break
        case 'token':
          updated.output += event.text
          break
        case 'usage':
          updated.inputTokens = event.inputTokens
          updated.outputTokens = event.outputTokens
          updated.cost = estimateCost(event.inputTokens, event.outputTokens)
          break
        case 'done':
          updated.status = 'done'
          updated.diff = event.diff
          updated.latencyMs = event.latencyMs
          updated.startedAt = null
          break
        case 'error':
          updated.status = 'failed'
          updated.error = event.message
          updated.startedAt = null
          break
      }

      next[idx] = updated
      return next.sort((a, b) => a.agentId - b.agentId)
    })
  }, [])

  useEffect(() => {
    const unsubscribe = window.agentRace.onAgentEvent(handleAgentEvent)
    return unsubscribe
  }, [handleAgentEvent])

  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setTick((t) => t + 1), 250)
    return () => window.clearInterval(id)
  }, [isRunning])

  const handleRun = async (): Promise<void> => {
    setRunError(null)
    setIsRunning(true)
    setAgents(
      Array.from({ length: agentCount }, (_, i) => ({
        ...createInitialAgentState(i + 1),
        status: 'running' as const,
        startedAt: Date.now()
      }))
    )

    const result = await window.agentRace.runAgents({
      repoPath: repoPath.trim(),
      taskPrompt: taskPrompt.trim(),
      agentCount
    })

    if (!result.ok) {
      setRunError(result.error)
      setAgents((prev) =>
        prev.map((a) =>
          a.status === 'running'
            ? { ...a, status: 'failed', error: result.error, startedAt: null }
            : a
        )
      )
    }

    setIsRunning(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Agent Race</h1>
          <p className="subtitle">Parallel coding agents on isolated git worktrees</p>
        </div>
        <div className="total-cost">
          <span className="total-cost__label">Total cost</span>
          <span className="total-cost__value">${totalCost.toFixed(4)}</span>
        </div>
      </header>

      <section className="controls">
        <label>
          Repository path
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="/path/to/your/repo"
            disabled={isRunning}
          />
        </label>

        <label>
          Task prompt
          <textarea
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="Describe the coding task for all agents..."
            rows={4}
            disabled={isRunning}
          />
        </label>

        <label className="agent-count">
          Agents (N)
          <input
            type="number"
            min={1}
            max={10}
            value={agentCount}
            onChange={(e) => setAgentCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            disabled={isRunning}
          />
        </label>

        <button type="button" onClick={handleRun} disabled={isRunning}>
          {isRunning ? 'Running…' : 'Run'}
        </button>

        {runError && <p className="run-error">{runError}</p>}
      </section>

      <section className="agent-grid">
        {agents.length === 0 ? (
          <p className="empty-state">Configure a repo and task, then hit Run.</p>
        ) : (
          agents.map((agent) => <AgentCard key={agent.agentId} agent={agent} />)
        )}
      </section>
    </div>
  )
}
