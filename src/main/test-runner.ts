import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const TEST_TIMEOUT_MS = 120_000
const MAX_OUTPUT_CHARS = 20_000

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  return text.slice(0, MAX_OUTPUT_CHARS) + `\n\n[output truncated at ${MAX_OUTPUT_CHARS} chars]`
}

/**
 * Run the user-supplied test command in an agent's worktree. Passing is defined
 * as a zero exit code. A non-zero exit (or a spawn failure such as an unknown
 * command) is reported as a failure with the captured output rather than thrown.
 */
export async function runTests(
  worktreePath: string,
  command: string
): Promise<{ passed: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: worktreePath,
      timeout: TEST_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024
    })
    return { passed: true, output: truncate(stdout + stderr) }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const captured = (e.stdout ?? '') + (e.stderr ?? '')
    return { passed: false, output: truncate(captured || e.message || 'Test command failed') }
  }
}
