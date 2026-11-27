/**
 * Local notifications for publish events. Permission is only requested from a
 * user gesture. These fire from events the app already observes (publish
 * results); they are NOT a scheduler — browser timers can't be relied on to
 * publish, and Web Push would need server-side delivery that doesn't exist yet.
 */
export type NotifyEvent = 'published' | 'failed' | 'due' | 'action-required' | 'retry-failed'

const COPY: Record<NotifyEvent, (d: string) => { title: string; body: string }> = {
  published: (d) => ({ title: 'Post published', body: d }),
  failed: (d) => ({ title: 'Publishing failed', body: d }),
  due: (d) => ({ title: 'Scheduled post is due', body: `${d} — open SmartVideo to publish it.` }),
  'action-required': (d) => ({ title: 'Action needed to publish', body: d }),
  'retry-failed': (d) => ({ title: 'Retry failed', body: d }),
}

export async function requestNotificationPermission(g: any = globalThis): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!g.Notification) return 'unsupported'
  if (g.Notification.permission !== 'default') return g.Notification.permission
  try { return await g.Notification.requestPermission() } catch { return 'denied' }
}

export function notify(event: NotifyEvent, detail: string, g: any = globalThis): boolean {
  if (!g.Notification || g.Notification.permission !== 'granted') return false
  try {
    const { title, body } = COPY[event](detail)
    new g.Notification(title, { body, tag: `sp-${event}`, icon: '/favicon.ico' })
    return true
  } catch { return false }
}

/** Plans whose time has arrived (for in-app "due" prompts while the app is open). */
export function dueNow<T extends { scheduledAt: number | null; status: string }>(plans: T[], now = Date.now(), alreadyNotified: Set<string> = new Set(), idOf: (p: T) => string = (p: any) => p.id): T[] {
  return plans.filter((p) => p.scheduledAt !== null && p.scheduledAt <= now && (p.status === 'draft' || p.status === 'queued') && !alreadyNotified.has(idOf(p)))
}
