import type { TaskKind, TaskStatus } from '@smartvid/task-queue'
import type { AgentUiTaskFacts } from '@smartvid/ui/lib/agent-ui'
import type { DownloadItem } from './types'

// biome-ignore lint/performance/noBarrelFile: Keep existing Desktop contracts while sharing the authoritative implementation with the browser.
export * from '@smartvid/ui/lib/agent-ui'

/** Native task projection used by Desktop's existing download cards. */
export interface AgentUiTask extends AgentUiTaskFacts {
  kind: TaskKind
  status: TaskStatus
  download?: Omit<DownloadItem, 'ytDlpCommand' | 'ytDlpLog' | 'error' | 'downloadPath'>
}
