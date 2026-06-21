import { execFile } from 'child_process'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const WORKTREE_BASE = '.agent-race-worktrees'

export async function createWorktree(repoPath: string, agentId: number): Promise<string> {
  const baseDir = join(repoPath, WORKTREE_BASE)
  await mkdir(baseDir, { recursive: true })

  const worktreePath = join(baseDir, `agent-${agentId}`)
  const branchName = `agent-race/${agentId}-${Date.now()}`

  await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
    cwd: repoPath
  })

  return worktreePath
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  try {
    await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
      cwd: repoPath
    })
  } catch {
    // Best-effort cleanup; worktree may already be gone
    try {
      await execFileAsync('git', ['worktree', 'prune'], { cwd: repoPath })
    } catch {
      // ignore
    }
  }
}

/**
 * Compute the unified diff of everything the agent changed in its worktree,
 * including new files. Stages all changes, then diffs the index against HEAD.
 */
export async function getWorktreeDiff(worktreePath: string): Promise<string> {
  await execFileAsync('git', ['add', '-A'], { cwd: worktreePath })
  const { stdout } = await execFileAsync('git', ['diff', '--cached'], {
    cwd: worktreePath,
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout
}

export async function assertGitRepo(repoPath: string): Promise<void> {
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: repoPath })
  } catch {
    throw new Error(`Not a git repository: ${repoPath}`)
  }
}
