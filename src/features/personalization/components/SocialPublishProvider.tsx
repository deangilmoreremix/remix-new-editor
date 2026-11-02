/**
 * remix-new-editor shim for OpenHiggsBolt's SocialPublishProvider.
 *
 * remix publishes through its own Publisher flow, so no provider is mounted
 * and the context is null. `DemoPersonalizeProvider` reads it through a safe
 * accessor and hides the in-modal "Publish" shortcut when it is absent.
 */
import { createContext } from 'react'

export type SocialPublishOptions = {
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  title?: string
  [key: string]: unknown
}

export interface SocialPublishContextValue {
  openPublish: (options: SocialPublishOptions) => void
  [key: string]: unknown
}

export const SocialPublishContext = createContext<SocialPublishContextValue | null>(null)
