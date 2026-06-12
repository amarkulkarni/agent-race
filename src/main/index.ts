import { config } from 'dotenv'
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { runAgent } from './agent'
import { assertGitRepo, createWorktree, removeWorktree } from './git'
import type { AgentEvent, RunAgentsRequest } from '../shared/types'

config()

let mainWindow: BrowserWindow | null = null

function emit(event: AgentEvent): void {
  mainWindow?.webContents.send('agent-event', event)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function runSingleAgent(
  agentId: number,
  repoPath: string,
  taskPrompt: string
): Promise<void> {
  let worktreePath = ''

  try {
    worktreePath = await createWorktree(repoPath, agentId)
    emit({ type: 'started', agentId, worktreePath })

    await runAgent(agentId, taskPrompt, worktreePath, emit)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ type: 'error', agentId, message })
  } finally {
    if (worktreePath) {
      await removeWorktree(repoPath, worktreePath)
    }
  }
}

async function handleRunAgents(request: RunAgentsRequest): Promise<void> {
  const { repoPath, taskPrompt, agentCount } = request

  if (!repoPath.trim()) {
    throw new Error('Repository path is required')
  }
  if (!taskPrompt.trim()) {
    throw new Error('Task prompt is required')
  }
  if (agentCount < 1 || agentCount > 10) {
    throw new Error('Agent count must be between 1 and 10')
  }

  await assertGitRepo(repoPath)

  const agents = Array.from({ length: agentCount }, (_, i) => i + 1)
  await Promise.all(agents.map((id) => runSingleAgent(id, repoPath, taskPrompt)))
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('run-agents', async (_event, request: RunAgentsRequest) => {
    try {
      await handleRunAgents(request)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false as const, error: message }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
