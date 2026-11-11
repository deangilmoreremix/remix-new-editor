/**
 * projectRestore.ts
 *
 * Cross-device project persistence utilities for the personalization system.
 *
 * Stores and retrieves full project state (edited assets, selections, asset roles,
 * first/last frame, CTA) via the Supabase-backed personalization projects API so
 * users can resume work on any device without losing state.
 *
 * localStorage remains the source of truth; Supabase persistence is best-effort
 * and does not block UI interactions.
 */

import type {
  PersonalizationSource,
  ClientProfile,
  AssetLibrary,
  PromptState,
  OutputType,
  VideoPersonalizationMode,
  ImagePersonalizationMode,
  GenerationOptions,
} from './types'

export interface PersonalizationProjectState {
  source: PersonalizationSource
  client: Partial<ClientProfile>
  assets: AssetLibrary
  prompt: PromptState
  outputType: OutputType
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  generation: GenerationOptions
  status: string
  errorMessage: string | null
}

export interface SavedProject {
  id: string
  source: PersonalizationSource
  client: Partial<ClientProfile>
  assets: AssetLibrary
  prompt: PromptState
  outputType: OutputType
  mode: VideoPersonalizationMode | ImagePersonalizationMode | null
  generation: GenerationOptions
  status: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

const API_ROUTE = '/api/personalization/project'

function buildProjectPayload(state: PersonalizationProjectState, existingId?: string): Record<string, unknown> {
  return {
    id: existingId || undefined,
    source: state.source,
    client: state.client,
    assets: state.assets,
    prompt: state.prompt,
    outputType: state.outputType,
    mode: state.mode,
    generation: state.generation,
    status: state.status,
    errorMessage: state.errorMessage,
  }
}

export async function saveProject(state: PersonalizationProjectState, existingId?: string): Promise<{ ok: boolean; projectId?: string; error?: string }> {
  try {
    const payload = buildProjectPayload(state, existingId)
    const res = await fetch(API_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: payload }),
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    const result = await res.json().catch(() => ({}))
    return { ok: true, projectId: result.project?.id || existingId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function loadProject(projectId: string): Promise<{ ok: boolean; project?: SavedProject; error?: string }> {
  try {
    const url = `${API_ROUTE}?id=${encodeURIComponent(projectId)}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    const result = await res.json().catch(() => ({}))
    const raw = result.project
    if (!raw) {
      return { ok: false, error: 'Project not found' }
    }

    const project: SavedProject = {
      id: raw.id,
      source: raw.source || {},
      client: raw.client || {},
      assets: raw.assets || {},
      prompt: raw.prompt || {},
      outputType: raw.output_type || 'prompt',
      mode: raw.mode || null,
      generation: raw.generation || {},
      status: raw.status || 'idle',
      errorMessage: raw.error_message || null,
      createdAt: raw.created_at || new Date().toISOString(),
      updatedAt: raw.updated_at || new Date().toISOString(),
    }

    return { ok: true, project }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function listProjects(): Promise<{ ok: boolean; projects?: SavedProject[]; error?: string }> {
  try {
    const url = `${API_ROUTE}?list=true`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    const result = await res.json().catch(() => ({}))
    const rawProjects = result.projects || []
    const projects: SavedProject[] = rawProjects.map((raw: Record<string, unknown>) => ({
      id: raw.id,
      source: raw.source || {},
      client: raw.client || {},
      assets: raw.assets || {},
      prompt: raw.prompt || {},
      outputType: raw.output_type || 'prompt',
      mode: raw.mode || null,
      generation: raw.generation || {},
      status: raw.status || 'idle',
      errorMessage: raw.error_message || null,
      createdAt: raw.created_at || new Date().toISOString(),
      updatedAt: raw.updated_at || new Date().toISOString(),
    }))

    return { ok: true, projects }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${API_ROUTE}?id=${encodeURIComponent(projectId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
