import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, AgentRaceApi, RunAgentsRequest } from '../shared/types'

const api: AgentRaceApi = {
  runAgents: (request) => ipcRenderer.invoke('run-agents', request),
  onAgentEvent: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, event: AgentEvent): void => {
      callback(event)
    }
    ipcRenderer.on('agent-event', handler)
    return () => {
      ipcRenderer.removeListener('agent-event', handler)
    }
  }
}

contextBridge.exposeInMainWorld('agentRace', api)
