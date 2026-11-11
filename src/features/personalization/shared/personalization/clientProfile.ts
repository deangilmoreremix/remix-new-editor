/**
 * clientProfile.ts
 *
 * Client profile storage utilities for the personalization system.
 */

import type { ClientProfile } from './types'

const STORAGE_KEY = 'smartvideo_clients'
const CURRENT_KEY = 'smartvideo_current_client_id'

function readStorage(): Record<string, ClientProfile> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStorage(data: Record<string, ClientProfile>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadClients(): ClientProfile[] {
  const data = readStorage()
  return Object.values(data).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getCurrentClientId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CURRENT_KEY)
}

export function saveClient(client: ClientProfile): ClientProfile {
  const data = readStorage()
  data[client.id] = { ...client, updatedAt: new Date().toISOString() }
  writeStorage(data)
  return data[client.id]
}

export function createClient(partial: Partial<ClientProfile>): ClientProfile {
  const id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const client: ClientProfile = {
    id,
    audience: partial.audience || 'me',
    name: partial.name || '',
    businessName: partial.businessName || '',
    industry: partial.industry || '',
    location: partial.location || '',
    productService: partial.productService || '',
    offer: partial.offer || '',
    ctaHeadline: partial.ctaHeadline || '',
    callToAction: partial.callToAction || '',
    phone: partial.phone || '',
    website: partial.website || '',
    brandDescription: partial.brandDescription || '',
    createdAt: now,
    updatedAt: now,
  }
  return saveClient(client)
}

export function deleteClient(id: string): void {
  const data = readStorage()
  delete data[id]
  writeStorage(data)
  if (typeof window !== 'undefined' && localStorage.getItem(CURRENT_KEY) === id) {
    localStorage.removeItem(CURRENT_KEY)
  }
}

export function setCurrentClientId(id: string | null): void {
  if (typeof window === 'undefined') return
  if (id) {
    localStorage.setItem(CURRENT_KEY, id)
  } else {
    localStorage.removeItem(CURRENT_KEY)
  }
}
