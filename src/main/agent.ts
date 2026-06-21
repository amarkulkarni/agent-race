import Anthropic from '@anthropic-ai/sdk'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve, sep } from 'path'
import { MODEL } from '../shared/config'
import type { AgentEvent } from '../shared/types'

const MAX_TURNS = 50
const MAX_FILES = 1000
const MAX_READ_CHARS = 100_000
const SKIP_DIRS = new Set(['.git', 'node_modules', '.agent-race-worktrees'])

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment or a .env file in the project root.'
    )
  }
  return key
}

function buildPrompt(taskPrompt: string): string {
  return `You are a coding agent working in an isolated git worktree — a full checkout of a real repository.

You have tools to explore and modify the repository:
- list_files: list files in the repo (recursive)
- read_file: read a file's contents
- write_file: create or overwrite a file

Task:
${taskPrompt}

Instructions:
- Start by exploring with list_files and read_file to understand the structure and conventions.
- Make the changes the task requires using write_file.
- Match the existing code style you observe.
- When finished, briefly state what you changed. Do NOT output a diff — it is computed automatically from your file changes.`
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_files',
    description:
      'List files in the worktree, recursively. Optionally pass a subdirectory (relative to the repo root). Skips .git and node_modules.',
    input_schema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Subdirectory relative to repo root. Defaults to the root.' }
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file. Path is relative to the repo root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path relative to repo root.' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file with the given content. Path is relative to the repo root. Parent directories are created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root.' },
        content: { type: 'string', description: 'Full file content to write.' }
      },
      required: ['path', 'content']
    }
  }
]

/** Resolve a model-supplied relative path, rejecting anything that escapes the worktree. */
function resolveSafe(worktreePath: string, rel: string): string {
  const base = resolve(worktreePath)
  const abs = resolve(base, rel)
  if (abs !== base && !abs.startsWith(base + sep)) {
    throw new Error(`Path "${rel}" escapes the worktree`)
  }
  return abs
}

async function listFiles(worktreePath: string, subdir: string): Promise<string> {
  const root = resolveSafe(worktreePath, subdir || '.')
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    if (results.length >= MAX_FILES) return
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return
      if (SKIP_DIRS.has(entry.name)) continue
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(abs)
      } else if (entry.isFile()) {
        results.push(relative(worktreePath, abs))
      }
    }
  }

  await walk(root)
  if (results.length === 0) return '(no files)'
  const header = results.length >= MAX_FILES ? `(showing first ${MAX_FILES} files)\n` : ''
  return header + results.sort().join('\n')
}

async function readFileTool(worktreePath: string, rel: string): Promise<string> {
  const abs = resolveSafe(worktreePath, rel)
  const content = await readFile(abs, 'utf-8')
  if (content.length > MAX_READ_CHARS) {
    return content.slice(0, MAX_READ_CHARS) + `\n\n[truncated at ${MAX_READ_CHARS} chars]`
  }
  return content
}

async function writeFileTool(worktreePath: string, rel: string, content: string): Promise<string> {
  const abs = resolveSafe(worktreePath, rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf-8')
  return `Wrote ${content.length} bytes to ${rel}`
}

async function executeTool(
  name: string,
  input: unknown,
  worktreePath: string
): Promise<{ content: string; isError: boolean }> {
  const args = (input ?? {}) as Record<string, unknown>
  try {
    switch (name) {
      case 'list_files':
        return { content: await listFiles(worktreePath, String(args.dir ?? '')), isError: false }
      case 'read_file':
        return { content: await readFileTool(worktreePath, String(args.path ?? '')), isError: false }
      case 'write_file':
        return {
          content: await writeFileTool(
            worktreePath,
            String(args.path ?? ''),
            String(args.content ?? '')
          ),
          isError: false
        }
      default:
        return { content: `Unknown tool: ${name}`, isError: true }
    }
  } catch (err) {
    return { content: err instanceof Error ? err.message : String(err), isError: true }
  }
}

/** Short, human-readable summary of a tool call for the live output stream. */
function describeInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>
    if (typeof obj.path === 'string') return obj.path
    if (typeof obj.dir === 'string') return obj.dir
  }
  return ''
}

export async function runAgent(
  agentId: number,
  taskPrompt: string,
  worktreePath: string,
  emit: (event: AgentEvent) => void,
  computeDiff: () => Promise<string>
): Promise<void> {
  const startedAt = Date.now()
  const client = new Anthropic({ apiKey: getApiKey() })

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: buildPrompt(taskPrompt) }]

  let totalInput = 0
  let totalOutput = 0

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      tools: TOOLS,
      messages
    })

    stream.on('text', (text) => emit({ type: 'token', agentId, text }))

    const finalMessage = await stream.finalMessage()
    totalInput += finalMessage.usage?.input_tokens ?? 0
    totalOutput += finalMessage.usage?.output_tokens ?? 0
    emit({ type: 'usage', agentId, inputTokens: totalInput, outputTokens: totalOutput })

    messages.push({ role: 'assistant', content: finalMessage.content })

    if (finalMessage.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of finalMessage.content) {
      if (block.type !== 'tool_use') continue
      emit({ type: 'token', agentId, text: `\n› ${block.name}(${describeInput(block.input)})\n` })
      const { content, isError } = await executeTool(block.name, block.input, worktreePath)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content,
        is_error: isError
      })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  const diff = await computeDiff()
  const latencyMs = Date.now() - startedAt
  emit({ type: 'done', agentId, diff, latencyMs })
}
