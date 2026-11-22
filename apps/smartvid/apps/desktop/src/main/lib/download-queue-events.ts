import type { Task } from '@smartvid/task-queue'

/**
 * Fresh adds and manual retries from failed/cancelled should appear as
 * active queue rows. Resume from paused stays on the existing row.
 */
export const shouldSurfaceQueuedDownload = (from: Task['status'] | null): boolean =>
  from === null || from === 'failed' || from === 'cancelled'
