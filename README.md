# Agent Race

Desktop app that runs **N** Anthropic coding agents in parallel on the same task. Each agent gets an isolated git worktree, streams output live, tracks token usage and cost, and returns a unified diff for comparison.

## Stack

- Electron + TypeScript + React (electron-vite)
- Anthropic Messages API (`@anthropic-ai/sdk`) with streaming
- Git worktrees via `child_process` (`git worktree add` / `remove`)

## Prerequisites

- Node.js 18+
- Git
- Anthropic API key

## Setup

```bash
cd /Users/amarkulkarni/cursor_projects/agent-race
npm install
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

## Run

```bash
npm run dev
```

## Usage

1. Enter the path to a **git repository** (must have at least one commit).
2. Enter a task prompt describing what you want changed.
3. Set **N** (number of parallel agents, default 3).
4. Click **Run**.

Each agent card shows:

- Live streaming output
- Status: running / done / failed
- Latency, token count, estimated cost
- Final unified diff (when complete)

A **total cost** counter updates across all agents.

## Configuration

Edit [`src/shared/config.ts`](src/shared/config.ts):

- `MODEL` — Anthropic model name
- `COST_PER_INPUT_TOKEN` / `COST_PER_OUTPUT_TOKEN` — pricing constants for cost estimates

## Project structure

```
src/
  main/       # Electron main — git, Anthropic, IPC
  preload/    # contextBridge API
  renderer/   # React dashboard
  shared/     # types + config (IPC contract)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron in development |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript check |

## Out of scope (for now)

- Applying diffs to main branch
- Running tests
- Ranking agents
- Auth / persistence
