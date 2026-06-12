/// <reference types="vite/client" />

import type { AgentRaceApi } from '@shared/types'

declare global {
  interface Window {
    agentRace: AgentRaceApi
  }
}

export {}
