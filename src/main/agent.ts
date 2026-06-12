import Anthropic from '@anthropic-ai/sdk'
import { MODEL } from '../shared/config'
import type { AgentEvent } from '../shared/types'

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment or a .env file in the project root.'
    )
  }
  return key
}

function buildPrompt(taskPrompt: string, worktreePath: string): string {
  return `You are a coding agent working in an isolated git worktree.

Repository worktree path: ${worktreePath}

Task:
${taskPrompt}

Instructions:
- Analyze the repository context implied by the task.
- Produce a unified diff (git diff format) that accomplishes the task.
- Output ONLY the unified diff — no markdown fences, no explanations before or after.
- Use standard unified diff format with ---/+++ headers and @@ hunks.`
}

function extractDiff(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:diff)?\n([\s\S]*?)```/)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }
  const diffStart = trimmed.search(/^diff --git/m)
  if (diffStart >= 0) {
    return trimmed.slice(diffStart).trim()
  }
  const unifiedStart = trimmed.search(/^--- /m)
  if (unifiedStart >= 0) {
    return trimmed.slice(unifiedStart).trim()
  }
  return trimmed
}

export async function runAgent(
  agentId: number,
  taskPrompt: string,
  worktreePath: string,
  emit: (event: AgentEvent) => void
): Promise<void> {
  const startedAt = Date.now()
  const client = new Anthropic({ apiKey: getApiKey() })
  const prompt = buildPrompt(taskPrompt, worktreePath)

  let fullText = ''

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  })

  stream.on('text', (text) => {
    fullText += text
    emit({ type: 'token', agentId, text })
  })

  const finalMessage = await stream.finalMessage()
  const inputTokens = finalMessage.usage?.input_tokens ?? 0
  const outputTokens = finalMessage.usage?.output_tokens ?? 0

  emit({ type: 'usage', agentId, inputTokens, outputTokens })

  const diff = extractDiff(fullText)
  const latencyMs = Date.now() - startedAt

  emit({ type: 'done', agentId, diff, latencyMs })
}
