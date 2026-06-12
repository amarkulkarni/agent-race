export type AgentStatus = 'idle' | 'running' | 'done' | 'failed'

export interface RunAgentsRequest {
  repoPath: string
  taskPrompt: string
  agentCount: number
}

export type AgentEvent =
  | { type: 'started'; agentId: number; worktreePath: string }
  | { type: 'token'; agentId: number; text: string }
  | { type: 'usage'; agentId: number; inputTokens: number; outputTokens: number }
  | { type: 'done'; agentId: number; diff: string; latencyMs: number }
  | { type: 'error'; agentId: number; message: string }

export interface AgentState {
  agentId: number
  status: AgentStatus
  worktreePath: string
  output: string
  diff: string
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
  error: string | null
  startedAt: number | null
}

export interface AgentRaceApi {
  runAgents: (request: RunAgentsRequest) => Promise<{ ok: true } | { ok: false; error: string }>
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void
}

export function createInitialAgentState(agentId: number): AgentState {
  return {
    agentId,
    status: 'idle',
    worktreePath: '',
    output: '',
    diff: '',
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    latencyMs: 0,
    error: null,
    startedAt: null
  }
}
