/**
 * remix-new-editor shim for OpenHiggsBolt's SocialPublishProvider context.
 *
 * mount.jsx provides the value: `openPublish()` opens remix's social-publish
 * modal (src/lib/socialPublishHelpers.js), the equivalent of OpenHiggsBolt's
 * SocialPublishModal.
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
