'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Share2, Play, Camera, Music2 } from 'lucide-react';
import SocialPublishModal from './SocialPublishModal';
import type { Asset, CopyState, ThumbnailState, Destination, PublishResult, WriteCopyState } from './social-publishing/types';

export type SocialPublishOptions = {
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  title?: string;
  caption?: string;
};

type SocialPublishContextValue = {
  openPublish: (opts: SocialPublishOptions) => void;
  closePublish: () => void;
  openSocialPublisher: (opts: { asset: Asset }) => void;
};

type SocialPublishState = {
  open: boolean;
  /** Changes every time publishing is opened for an asset; late results from an older one are dropped. */
  sessionId: number;
  currentStep: number;
  asset: Asset | null;
  writeCopy: WriteCopyState;
  socialCopy: CopyState;
  thumbnail: ThumbnailState;
  destinations: Destination[];
  publishResults: PublishResult[];
};

const EMPTY_WRITE_COPY: WriteCopyState = {
  master: '',
  platforms: {},
  variants: [],
  selectedVariantId: undefined,
};

const EMPTY_COPY: CopyState = {
  master: '',
  platforms: {},
  variants: [],
  selectedVariantId: undefined,
  title: '',
  description: '',
  tags: '',
  caption: '',
  tiktokTitle: '',
  headline: '',
  subheadline: '',
  subject: '',
  visualIdea: '',
};

const EMPTY_THUMBNAIL: ThumbnailState = {};

export const SocialPublishContext = createContext<SocialPublishContextValue | null>(null);

export function SocialPublishProvider({
  apiKey,
  children,
  onRequestApiKey,
}: {
  apiKey: string | null;
  children: ReactNode;
  /** Opens the API keys modal (AI writing needs the customer's OpenAI key). */
  onRequestApiKey?: () => void;
}) {
  const sessionRef = useRef(0);
  const [state, setState] = useState<SocialPublishState>({
    open: false,
    sessionId: 0,
    currentStep: 0,
    asset: null,
    writeCopy: EMPTY_WRITE_COPY,
    socialCopy: EMPTY_COPY,
    thumbnail: EMPTY_THUMBNAIL,
    destinations: [],
    publishResults: [],
  });

  const openPublish = useCallback((opts: SocialPublishOptions) => {
    const title = opts.title || '';
    const caption = opts.caption || '';
    sessionRef.current += 1;
    setState({
      open: true,
      sessionId: sessionRef.current,
      currentStep: 0,
      asset: {
        id: `asset-${Date.now()}`,
        url: opts.mediaUrl || '',
        type: opts.mediaType === 'image' ? 'image' : 'video',
      },
      writeCopy: {
        ...EMPTY_WRITE_COPY,
        master: title || caption || '',
      },
      socialCopy: {
        ...EMPTY_COPY,
        title,
        caption,
        tiktokTitle: title,
      },
      thumbnail: EMPTY_THUMBNAIL,
      destinations: [],
      publishResults: [],
    });
  }, []);

  const openSocialPublisher = useCallback((opts: { asset: Asset }) => {
    sessionRef.current += 1;
    setState({
      open: true,
      sessionId: sessionRef.current,
      currentStep: 0,
      asset: opts.asset,
      writeCopy: { ...EMPTY_WRITE_COPY },
      socialCopy: { ...EMPTY_COPY },
      thumbnail: EMPTY_THUMBNAIL,
      destinations: [],
      publishResults: [],
    });
  }, []);

  const closePublish = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const setCurrentStep = useCallback((currentStep: number) => {
    setState((s) => ({ ...s, currentStep }));
  }, []);

  const updateWriteCopy = useCallback((writeCopy: WriteCopyState) => {
    setState((s) => ({ ...s, writeCopy }));
  }, []);

  const updateSocialCopy = useCallback((socialCopy: CopyState) => {
    setState((s) => ({ ...s, socialCopy }));
  }, []);

  // The Thumbnail step sends partial updates (just the aspect ratio, just the
  // references, ...). Merge them so one change never wipes the chosen image.
  const updateThumbnail = useCallback((thumbnail: ThumbnailState) => {
    setState((s) => {
      // Other-shape versions were made from the old picture: drop them when it changes.
      const changed = thumbnail.imageUrl !== undefined && thumbnail.imageUrl !== s.thumbnail.imageUrl && !('variants' in thumbnail);
      return { ...s, thumbnail: { ...s.thumbnail, ...thumbnail, ...(changed ? { variants: undefined } : {}) } };
    });
  }, []);

  const updateDestinations = useCallback((destinations: Destination[]) => {
    setState((s) => ({ ...s, destinations }));
  }, []);

  // A publish started for an earlier asset can finish after the modal was reopened for another one.
  // Its results belong to that earlier session, so they are ignored here.
  const updatePublishResults = useCallback((publishResults: PublishResult[], forSession?: number) => {
    if (forSession !== undefined && forSession !== sessionRef.current) return;
    setState((s) => ({ ...s, publishResults }));
  }, []);

  const value = useMemo(
    () => ({
      openPublish,
      closePublish,
      openSocialPublisher,
    }),
    [openPublish, closePublish, openSocialPublisher]
  );

  return (
    <SocialPublishContext.Provider value={value}>
      {children}
      <SocialPublishModal
        open={state.open}
        onClose={closePublish}
        apiKey={apiKey ?? ''}
        currentStep={state.currentStep}
        setCurrentStep={setCurrentStep}
        asset={state.asset}
        writeCopy={state.writeCopy}
        socialCopy={state.socialCopy}
        thumbnail={state.thumbnail}
        destinations={state.destinations}
        publishResults={state.publishResults}
        sessionId={state.sessionId}
        updateWriteCopy={updateWriteCopy}
        updateSocialCopy={updateSocialCopy}
        updateThumbnail={updateThumbnail}
        updateDestinations={updateDestinations}
        updatePublishResults={updatePublishResults}
        onRequestApiKey={onRequestApiKey}
      />
    </SocialPublishContext.Provider>
  );
}

export function useSocialPublish(): SocialPublishContextValue {
  const ctx = useContext(SocialPublishContext);
  if (!ctx) {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>');
  }
  return ctx;
}

const PLATFORM_ICONS: Record<string, React.ComponentType<any>> = {
  youtube: Play,
  instagram: Camera,
  tiktok: Music2,
};

export function PublishStep({
  mediaUrl,
  mediaType = 'video',
  title,
  caption,
  className,
  style,
}: {
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video';
  title?: string;
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { openPublish } = useSocialPublish();
  if (!mediaUrl) return null;

  const platforms = mediaType === 'image' ? ['instagram'] : ['youtube', 'instagram', 'tiktok'];

  return (
    <button
      type="button"
      onClick={() => openPublish({ mediaUrl, mediaType, title, caption })}
      title="Post this to a social network"
      className={
        className ||
        'flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:border-[#d9ff00]/40'
      }
      style={style}
    >
      <Share2 size={14} className="text-[#d9ff00]" />
      <span>Post to social</span>
      <span className="flex items-center gap-1 ml-1 opacity-70">
        {platforms.map((p) => {
          const Icon = PLATFORM_ICONS[p];
          return <Icon key={p} size={12} />;
        })}
      </span>
    </button>
  );
}

export function PublishButton({
  mediaUrl,
  mediaType = 'video',
  title,
  caption,
  children,
  className,
  style,
}: {
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video';
  title?: string;
  caption?: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { openPublish } = useSocialPublish();
  if (!mediaUrl) return null;
  return (
    <button
      type="button"
      onClick={() => openPublish({ mediaUrl, mediaType, title, caption })}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
