'use client'

/**
 * Owner notifications for the overlay editor (Stage 11): opt-in browser notifications when someone uses a video (a form, a button, a
 * call). Nothing is requested until "Turn on" is pressed. Without the server's VAPID keys the panel says so and offers nothing.
 */
import { useCallback, useEffect, useState } from 'react'
import { disablePush, enablePush, loadServerInfo, localState, pushSupport, sendTestPush, type PushEnv, type PushServerInfo } from '../notify/pushClient'
import { C, chipStyle, hintStyle, labelStyle, softPanelStyle } from './tokens'

export interface NotificationsPanelProps { env?: PushEnv; deviceLabel?: string }
const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

export function NotificationsPanel({ env, deviceLabel }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [server, setServer] = useState<PushServerInfo | null>(null)
  const [serverProblem, setServerProblem] = useState<string | null>(null)
  const [local, setLocal] = useState<{ permission: NotificationPermission | 'unsupported'; subscribed: boolean }>({ permission: 'unsupported', subscribed: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const support = pushSupport(env)

  const refresh = useCallback(async () => {
    const [s, l] = await Promise.all([loadServerInfo(env), localState(env)])
    if (s.ok) { setServer(s.info); setServerProblem(null) } else { setServer(null); setServerProblem(s.message) }
    setLocal(l); setLoading(false)
  }, [env])
  // Nothing is requested from the server until the owner opens the panel.
  useEffect(() => { if (open) void refresh() }, [open, refresh])

  const turnOn = async () => {
    setBusy(true); setMsg(null)
    try { const r = await enablePush(server?.publicKey ?? null, env, deviceLabel); setMsg(r.ok ? { text: 'Notifications are on in this browser. Press "Send me a test" to check.', bad: false } : { text: r.message, bad: true }); await refresh() } finally { setBusy(false) }
  }
  const turnOff = async () => { setBusy(true); setMsg(null); try { const r = await disablePush(env); setMsg({ text: r.message, bad: !r.ok }); await refresh() } finally { setBusy(false) } }
  const test = async () => { setBusy(true); setMsg(null); try { const r = await sendTestPush(env); setMsg(r.ok ? { text: r.note || 'Test sent.', bad: false } : { text: r.message, bad: true }); await refresh() } finally { setBusy(false) } }

  let body: React.ReactNode
  if (loading) body = <p style={hintStyle} role="status">Checking…</p>
  else if (!support.ok) body = <p style={hintStyle} data-testid="notify-unsupported">{support.message}</p>
  else if (serverProblem) body = <p style={hintStyle} role="alert" data-testid="notify-problem">{serverProblem}</p>
  else if (!server?.configured) body = <p style={hintStyle} data-testid="notify-not-configured">Browser notifications are not set up on this server yet. The server owner needs to add the notification keys (see the project notes). Your in-app alerts still work.</p>
  else if (server.storage === 'unavailable') body = <p style={hintStyle} data-testid="notify-no-storage">Notifications need a database update that is not installed on this server yet.</p>
  else body = (
    <>
      <p style={{ ...hintStyle, color: C.text }} data-testid="notify-status">{local.subscribed ? 'Notifications are ON in this browser.' : local.permission === 'denied' ? 'Notifications are blocked for this site in this browser.' : 'Notifications are off in this browser.'}{server.devices.length > 0 ? ` ${server.devices.length} device${server.devices.length === 1 ? ' is' : 's are'} set up on your account.` : ''}</p>
      <div style={row}>
        {local.subscribed ? <button type="button" style={small} disabled={busy} onClick={() => void test()}>Send me a test</button> : <button type="button" style={small} disabled={busy || local.permission === 'denied'} onClick={() => void turnOn()}>Turn on</button>}
        {local.subscribed ? <button type="button" style={small} disabled={busy} onClick={() => void turnOff()}>Turn off</button> : null}
      </div>
      {local.permission === 'denied' ? <p style={hintStyle}>To allow them again, open your browser's site settings (the lock or tune icon next to the address), set Notifications to Allow, and reload.</p> : null}
    </>
  )

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="notifications-panel">
      <div style={labelStyle}>Notifications</div>
      <p style={hintStyle}>Get a notification on this device when someone submits a form, clicks a button or calls from one of your videos. Only you receive them; you can turn them off here at any time.</p>
      {open ? body : <button type="button" style={{ ...small, alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Set up notifications</button>}
      {msg ? <div role={msg.bad ? 'alert' : 'status'} data-testid="notify-message" style={hintStyle}>{msg.text}</div> : null}
    </div>
  )
}
