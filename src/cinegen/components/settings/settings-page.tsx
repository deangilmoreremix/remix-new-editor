import { useState, useEffect, useCallback, useRef } from 'react';
import type { DefaultTranscriptionEngine } from '@cinegen/lib/utils/api-key';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunpodLtxApi = any; // [remix] desktop RunPod session API (unused on the web)
interface SettingsPageProps { onBack: () => void; projectId: string; useSqlite?: boolean }
type Ltx25GpuProfile = 'balanced' | 'fast' | 'economy'; // [remix] RunPod sessions are desktop-only
// @ts-expect-error plain JS key manager from the main app
import { apiKeyManager } from '../../../lib/apiKeyManager.js';
import {
  DEFAULT_VIDEO_GENERATION_PROVIDER,
  VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
  type VideoGenerationProvider,
} from '@cinegen/lib/utils/video-generation-provider';

/* -----------------------------------------------------------------------
   Types & constants
   ----------------------------------------------------------------------- */

const STORAGE_KEY = 'cinegen_settings';

type Provider = 'fal' | 'kie';
type SettingsTab = 'app' | 'project';
type RunpodLtxImageModel = 'sdxl' | 'qwen-image-edit';

/* Sidebar category IDs — these double as scroll-anchor IDs */
type AppCategory = 'claude' | 'cloud' | 'elevenlabs' | 'api-keys' | 'endpoints' | 'pod' | 'provider' | 'preferences';
type ProjectCategory = 'resolution' | 'frame-rate' | 'aspect-ratio';
type Category = AppCategory | ProjectCategory;

type RunpodLtxSetupStatus =
  | 'not-configured'
  | 'validating'
  | 'creating-pod'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'terminating'
  | 'error';

const APP_CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: 'api-keys', label: 'API Keys' },
  { id: 'preferences', label: 'Preferences' },
];

const PROJECT_CATEGORIES: { id: ProjectCategory; label: string }[] = [
  { id: 'resolution', label: 'Resolution' },
  { id: 'frame-rate', label: 'Frame Rate' },
  { id: 'aspect-ratio', label: 'Aspect Ratio' },
];

interface Settings {
  falKey: string;
  kieKey: string;
  openaiKey: string;
  runpodKey: string;
  runpodEndpoints: Record<string, string>;
  podId: string;
  podUrl: string;
  huggingFaceToken: string;
  runpodLtxPodId: string;
  runpodLtxPodUrl: string;
  runpodLtxPodAuthToken: string;
  runpodLtxSecretIds: string[];
  runpodLtxStatus: RunpodLtxSetupStatus;
  runpodLtxGpuProfile: Ltx25GpuProfile;
  runpodLtxImageModels: RunpodLtxImageModel[];
  runpodLtxActiveImageModels?: RunpodLtxImageModel[];
  provider: Provider;
  videoGenerationProvider: VideoGenerationProvider;
  videoGenerationProviderSettingsVersion: number;
  defaultTranscriptionEngine: DefaultTranscriptionEngine;
  autoVisualIndexing: boolean;
  analyzeVisionOnImport: boolean;
  backgroundVisionModel: string;
  cutVisionModel: string;
  maxConcurrentVisionJobs: number;
  reduceMotion: boolean;
  resolutionWidth: number;
  resolutionHeight: number;
  frameRate: 24 | 30 | 60;
  aspectRatio: string;
}

const DEFAULT_SETTINGS: Settings = {
  falKey: '',
  kieKey: '',
  openaiKey: '',
  runpodKey: '',
  runpodEndpoints: {},
  podId: '',
  podUrl: '',
  huggingFaceToken: '',
  runpodLtxPodId: '',
  runpodLtxPodUrl: '',
  runpodLtxPodAuthToken: '',
  runpodLtxSecretIds: [],
  runpodLtxStatus: 'not-configured',
  runpodLtxGpuProfile: 'balanced',
  runpodLtxImageModels: ['sdxl', 'qwen-image-edit'],
  provider: 'fal',
  videoGenerationProvider: DEFAULT_VIDEO_GENERATION_PROVIDER,
  videoGenerationProviderSettingsVersion: VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
  defaultTranscriptionEngine: 'faster-whisper-local',
  autoVisualIndexing: false, // [remix] until the visual-index worker is ported
  analyzeVisionOnImport: false,
  backgroundVisionModel: 'openai/gpt-5.6-sol',
  cutVisionModel: 'openai/gpt-5.6-sol',
  maxConcurrentVisionJobs: 2,
  reduceMotion: false,
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  frameRate: 24,
  aspectRatio: '16:9',
};

const RUNPOD_MODELS = [
  { key: 'runpod-sdxl',            label: 'Stable Diffusion XL (Serverless)' },
  { key: 'runpod-qwen-image-edit', label: 'Qwen Image Edit (Serverless)' },
  { key: 'runpod-wan-t2v',         label: 'Wan 2.1 T2V' },
  { key: 'runpod-wan-i2v',         label: 'Wan 2.1 I2V' },
  { key: 'runpod-flux-dev',        label: 'FLUX Dev' },
];

const TRANSCRIPTION_ENGINES: Array<{ value: DefaultTranscriptionEngine; label: string }> = [
  { value: 'faster-whisper-local', label: 'On your device (Whisper)' }, // [remix] browser Whisper
];

const VISION_MODEL_OPTIONS = [
  { value: 'openai/gpt-5.6-sol', label: 'OpenAI (your key)' }, // [remix]
];

const RESOLUTION_PRESETS = [
  { label: 'HD',  w: 1280, h: 720,  tag: '720p' },
  { label: 'Full HD', w: 1920, h: 1080, tag: '1080p' },
  { label: '2K',  w: 2560, h: 1440, tag: '1440p' },
  { label: '4K',  w: 3840, h: 2160, tag: '2160p' },
];

const ASPECT_RATIOS = ['16:9', '4:3', '21:9', '1:1', '9:16'];

const RUNPOD_LTX_GPU_PROFILE_OPTIONS: ReadonlyArray<{
  id: Ltx25GpuProfile;
  name: string;
  tier: string;
  hardware: string;
  detail: string;
}> = [
  {
    id: 'economy',
    name: 'Lower cost',
    tier: 'COST',
    hardware: 'A40, A6000, or L40 · 48 GB VRAM',
    detail: 'The lowest-cost compatible pool. Expect video generation to take longer.',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    tier: 'DEFAULT',
    hardware: 'RTX PRO 6000 Blackwell · 96 GB VRAM',
    detail: 'Strong speed and memory headroom without moving to the premium compute pool.',
  },
  {
    id: 'performance',
    name: 'Maximum speed',
    tier: 'FAST',
    hardware: 'B200 or H200 first · 80–180 GB VRAM',
    detail: 'The fastest render pool, with H100 fallback. Usually the highest hourly rate.',
  },
];

const RUNPOD_LTX_IMAGE_MODEL_IDS = ['sdxl', 'qwen-image-edit'] as const;
const RUNPOD_LTX_BASE_WEIGHT_GB = 66;
const RUNPOD_LTX_IMAGE_MODEL_OPTIONS: ReadonlyArray<{
  id: RunpodLtxImageModel;
  name: string;
  sizeGb: number;
  purpose: string;
  requirement: string;
}> = [
  {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    sizeGb: 6.9,
    purpose: 'Text-to-image',
    requirement: 'Creates new storyboard and Spaces images from a prompt.',
  },
  {
    id: 'qwen-image-edit',
    name: 'Qwen Image Edit',
    sizeGb: 31,
    purpose: 'Image editing',
    requirement: 'Needs a source image; follows instructions to revise an existing frame.',
  },
];

function normalizeRunpodLtxGpuProfile(value: unknown): Ltx25GpuProfile {
  return value === 'economy' || value === 'performance' ? value : 'balanced';
}

function normalizeRunpodLtxImageModels(
  value: unknown,
  fallback: RunpodLtxImageModel[] = [...RUNPOD_LTX_IMAGE_MODEL_IDS],
): RunpodLtxImageModel[] {
  if (!Array.isArray(value)) return fallback;
  return RUNPOD_LTX_IMAGE_MODEL_IDS.filter((id) => value.includes(id));
}

function normalizeActiveRunpodLtxImageModels(value: unknown): RunpodLtxImageModel[] | undefined {
  return Array.isArray(value) ? normalizeRunpodLtxImageModels(value, []) : undefined;
}

function runpodLtxEstimatedWeightGb(imageModels: RunpodLtxImageModel[]): number {
  return RUNPOD_LTX_BASE_WEIGHT_GB + RUNPOD_LTX_IMAGE_MODEL_OPTIONS.reduce(
    (total, model) => total + (imageModels.includes(model.id) ? model.sizeGb : 0),
    0,
  );
}

function runpodLtxStartupEstimate(imageModels: RunpodLtxImageModel[]): string {
  if (imageModels.includes('qwen-image-edit') && imageModels.includes('sdxl')) return 'Longest first start';
  if (imageModels.includes('qwen-image-edit')) return 'Significantly longer first start';
  if (imageModels.includes('sdxl')) return 'Slightly longer first start';
  return 'Standard LTX first start';
}

function runpodLtxModelSummary(imageModels: RunpodLtxImageModel[]): string {
  const names = RUNPOD_LTX_IMAGE_MODEL_OPTIONS
    .filter((model) => imageModels.includes(model.id))
    .map((model) => model.id === 'sdxl' ? 'SDXL' : 'Qwen Image Edit');
  return names.length ? `LTX-2.5 + ${names.join(' + ')}` : 'LTX-2.5 video only';
}

/* -----------------------------------------------------------------------
   Persistence
   ----------------------------------------------------------------------- */

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    const merged = {
      ...DEFAULT_SETTINGS,
      ...saved,
      videoGenerationProvider: saved.videoGenerationProviderSettingsVersion === VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION
        ? saved.videoGenerationProvider ?? DEFAULT_VIDEO_GENERATION_PROVIDER
        : DEFAULT_VIDEO_GENERATION_PROVIDER,
      videoGenerationProviderSettingsVersion: VIDEO_GENERATION_PROVIDER_SETTINGS_VERSION,
      runpodLtxGpuProfile: normalizeRunpodLtxGpuProfile(saved.runpodLtxGpuProfile),
      runpodLtxImageModels: normalizeRunpodLtxImageModels(saved.runpodLtxImageModels),
      runpodLtxActiveImageModels: normalizeActiveRunpodLtxImageModels(saved.runpodLtxActiveImageModels),
    };
    return merged.runpodLtxPodId
      ? merged
      : {
          ...merged,
          runpodLtxStatus: 'not-configured',
          videoGenerationProvider: merged.videoGenerationProvider === 'runpod' ? DEFAULT_VIDEO_GENERATION_PROVIDER : merged.videoGenerationProvider,
        };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cinegen:settings-changed'));
  }
}

const RUNPOD_LTX_STEPS: Array<{ status: RunpodLtxSetupStatus; label: string }> = [
  { status: 'validating', label: 'Validate accounts' },
  { status: 'creating-pod', label: 'Create GPU Pod' },
  { status: 'downloading', label: 'Download models' },
  { status: 'loading', label: 'Load models' },
  { status: 'ready', label: 'Ready' },
];

function normalizeRunpodLtxStatus(status: unknown, phase?: unknown): RunpodLtxSetupStatus {
  const statusValue = String(status ?? '').trim().toLowerCase();
  const phaseValue = String(phase ?? '').trim().toLowerCase();
  const value = `${statusValue} ${phaseValue}`.trim();
  if (/fail|error|cancel|\bended\b|\bstopped\b/.test(value)) return 'error';
  if (/ready|complete|healthy/.test(value)) return 'ready';
  if (/terminat|delet|remov/.test(value)) return 'terminating';
  if (/\bload(?:ing)?\b|warm|initializ|gpu memory/.test(phaseValue)) return 'loading';
  if (/download|fetch|cache/.test(phaseValue) || /download/.test(statusValue)) return 'downloading';
  if (/pod|creat|provision|deploy/.test(value)) return 'creating-pod';
  if (/valid|account|auth/.test(value)) return 'validating';
  return 'not-configured';
}

function friendlyRunpodLtxError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/401|403|unauthori|api key/i.test(message)) {
    return 'RunPod rejected the API key. Check that the key can create and delete Pods and secrets.';
  }
  if (/hugging\s*face|gated|model terms|license/i.test(message)) {
    return 'LTX-2.5 access was denied. Accept the model terms, then check your Hugging Face read token.';
  }
  if (/fund|balance|billing|payment|quota/i.test(message)) {
    return 'RunPod could not create the Pod. Check billing and account limits in the RunPod console.';
  }
  return 'The LTX-2.5 session did not start. No key or token was displayed. Try again or check the RunPod console.';
}

function friendlyRunpodLtxStatusCheckError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/401|403|unauthori|api key/i.test(message)) {
    return 'CineGen could not refresh the session because RunPod rejected the API key. Automatic checks will continue.';
  }
  return 'CineGen could not refresh the session status. Automatic checks will continue while the session starts.';
}

/* -----------------------------------------------------------------------
   Icons
   ----------------------------------------------------------------------- */

function IconKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'left'
        ? <polyline points="15 18 9 12 15 6" />
        : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

/* -----------------------------------------------------------------------
   Sub-components
   ----------------------------------------------------------------------- */

function ApiKeyField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sp-field">
      <label className="sp-field__label">
        <IconKey /> {label}
      </label>
      <div className="sp-field__key-row">
        <input
          type={visible ? 'text' : 'password'}
          className="sp-field__input sp-field__input--mono"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
        />
        <button
          className="sp-field__eye-btn"
          onClick={() => setVisible((v) => !v)}
          title={visible ? 'Hide' : 'Reveal'}
          type="button"
          disabled={disabled}
        >
          <IconEye open={visible} />
        </button>
      </div>
    </div>
  );
}

function getRunpodLtxApi(): RunpodLtxApi {
  return window.electronAPI.pod as typeof window.electronAPI.pod & RunpodLtxApi;
}

function runpodLtxStatusMessage(status: RunpodLtxSetupStatus): string {
  switch (status) {
    case 'validating': return 'Checking RunPod access and permission for the selected generation models.';
    case 'creating-pod': return 'Creating a temporary RunPod generation Pod.';
    case 'downloading': return 'Downloading the models selected for this temporary session. Larger model sets take longer to start.';
    case 'loading': return 'Loading the selected generation models and checking the session.';
    case 'ready': return 'The RunPod generation session is ready. LTX-2.5 is available for Director video generation.';
    case 'terminating': return 'Deleting the Pod and its temporary model files to stop session charges.';
    case 'error': return 'The session needs attention. Any Pod already created was left in place so you can check or delete it.';
    default: return 'No RunPod generation Pod is running. Choose the models you want, then start a session.';
  }
}

export function SettingsPage({ onBack, projectId, useSqlite }: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<SettingsTab>('app');
  const [activeCategory, setActiveCategory] = useState<Category>('api-keys');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [muapiKey, setMuapiKey] = useState<string>(() => { try { return apiKeyManager.getMuapiKey?.() ?? ''; } catch { return ''; } });
  const [openaiKey, setOpenaiKey] = useState<string>(() => { try { return apiKeyManager.getOpenAIKey?.() ?? ''; } catch { return ''; } });
  const [runpodLtxStatus, setRunpodLtxStatus] = useState<RunpodLtxSetupStatus>(settings.runpodLtxStatus);
  const [runpodLtxBusy, setRunpodLtxBusy] = useState(false);
  const [runpodLtxChecking, setRunpodLtxChecking] = useState(false);
  const [runpodLtxError, setRunpodLtxError] = useState('');
  const [runpodLtxMessage, setRunpodLtxMessage] = useState('');
  const [runpodLtxLastCheckedAt, setRunpodLtxLastCheckedAt] = useState<number | null>(null);
  const [runpodLtxCostPerHr, setRunpodLtxCostPerHr] = useState<number | null>(null);
  const [runpodLtxGpu, setRunpodLtxGpu] = useState('');
  const [runpodCostConfirmed, setRunpodCostConfirmed] = useState(false);
  const [showRunpodEndConfirm, setShowRunpodEndConfirm] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const runpodLtxOperationRef = useRef(false);
  const runpodLtxSettingsRef = useRef(settings);
  const runpodLtxStatusRequestSequenceRef = useRef(0);
  const runpodLtxStatusRequestRef = useRef<{
    requestId: number;
    podId: string;
    promise: Promise<void>;
  } | null>(null);
  runpodLtxSettingsRef.current = settings;

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onBack();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onBack]);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const refreshRunpodLtxStatus = useCallback((): Promise<void> => {
    const existingRequest = runpodLtxStatusRequestRef.current;
    if (existingRequest) return existingRequest.promise;

    const snapshot = runpodLtxSettingsRef.current;
    const runpodKey = snapshot.runpodKey.trim();
    const podId = snapshot.runpodLtxPodId.trim();
    if (!runpodKey || !podId) return Promise.resolve();

    const requestId = ++runpodLtxStatusRequestSequenceRef.current;
    setRunpodLtxChecking(true);
    const promise = (async () => {
      try {
        const result = await getRunpodLtxApi().statusLtx25({
          runpodKey,
          podId,
          podUrl: snapshot.runpodLtxPodUrl.trim(),
          podAuthToken: snapshot.runpodLtxPodAuthToken,
          secretIds: snapshot.runpodLtxSecretIds,
        });
        const current = runpodLtxSettingsRef.current;
        if (
          runpodLtxStatusRequestSequenceRef.current !== requestId
          || current.runpodLtxPodId.trim() !== podId
        ) return;

        setRunpodLtxLastCheckedAt(Date.now());
        setRunpodLtxMessage(result.message?.trim() || 'RunPod returned the latest session status.');
        if (String(result.status ?? '').toLowerCase() === 'ended') {
          setRunpodLtxStatus('not-configured');
          setRunpodLtxCostPerHr(null);
          setRunpodLtxGpu('');
          setRunpodLtxError('');
          setRunpodCostConfirmed(false);
          update({
            runpodLtxPodId: '',
            runpodLtxPodUrl: '',
            runpodLtxPodAuthToken: '',
            runpodLtxSecretIds: [],
            runpodLtxActiveImageModels: undefined,
            runpodLtxStatus: 'not-configured',
            ...(current.podId === podId ? { podId: '', podUrl: '' } : {}),
            ...(current.videoGenerationProvider === 'runpod' ? { videoGenerationProvider: DEFAULT_VIDEO_GENERATION_PROVIDER } : {}),
          });
          return;
        }
        const normalized = result.ready
          ? 'ready'
          : normalizeRunpodLtxStatus(result.status, result.phase);
        const nextStatus = normalized === 'not-configured' ? 'loading' : normalized;
        const failedPodWasCleaned = result.phase === 'startup-failed-cleaned';
        const cleanupMustBeConfirmed = result.phase === 'startup-failed-cleanup-required';
        setRunpodLtxStatus(nextStatus);
        setRunpodLtxCostPerHr(result.costPerHr ?? null);
        setRunpodLtxGpu(result.gpu || '');
        setRunpodLtxError(
          failedPodWasCleaned
            ? (/could not remove one temporary secret/i.test(result.message || '')
                ? 'The failed LTX-2.5 Pod was deleted and billing stopped. RunPod could not remove one temporary secret; check RunPod Secrets.'
                : 'The failed LTX-2.5 Pod and its temporary secrets were deleted. Billing stopped. Start a new session to retry.')
            : cleanupMustBeConfirmed
              ? 'The LTX-2.5 container could not start, and cleanup could not be confirmed. Delete this Pod in RunPod now to stop billing.'
              : nextStatus === 'error' ? result.message?.trim() || runpodLtxStatusMessage('error') : '',
        );
        const podUrl = result.podUrl?.trim() || current.runpodLtxPodUrl;
        if (failedPodWasCleaned) {
          setRunpodCostConfirmed(false);
          setShowRunpodEndConfirm(false);
          update({
            runpodLtxPodId: '',
            runpodLtxPodUrl: '',
            runpodLtxPodAuthToken: '',
            runpodLtxSecretIds: [],
            runpodLtxActiveImageModels: undefined,
            runpodLtxStatus: 'error',
            ...(current.podId === podId ? { podId: '', podUrl: '' } : {}),
            ...(current.videoGenerationProvider === 'runpod' ? { videoGenerationProvider: DEFAULT_VIDEO_GENERATION_PROVIDER } : {}),
          });
        } else {
          update({ runpodLtxStatus: nextStatus, runpodLtxPodUrl: podUrl, ...(podUrl ? { podUrl } : {}) });
        }
      } catch (cause) {
        const current = runpodLtxSettingsRef.current;
        if (
          runpodLtxStatusRequestSequenceRef.current !== requestId
          || current.runpodLtxPodId.trim() !== podId
        ) return;
        setRunpodLtxLastCheckedAt(Date.now());
        setRunpodLtxMessage(friendlyRunpodLtxStatusCheckError(cause));
      } finally {
        if (runpodLtxStatusRequestRef.current?.requestId === requestId) {
          runpodLtxStatusRequestRef.current = null;
          setRunpodLtxChecking(false);
        }
      }
    })();
    runpodLtxStatusRequestRef.current = { requestId, podId, promise };
    return promise;
  }, [update]);

  useEffect(() => {
    if (!settings.runpodLtxPodId || !settings.runpodKey) return;
    if (runpodLtxStatus === 'ready' || runpodLtxStatus === 'error') return;
    let cancelled = false;
    let timeoutId: number | undefined;
    const poll = async () => {
      await refreshRunpodLtxStatus();
      if (cancelled) return;
      timeoutId = window.setTimeout(() => void poll(), 6000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [refreshRunpodLtxStatus, runpodLtxStatus, settings.runpodKey, settings.runpodLtxPodId]);

  const setupRunpodLtx = useCallback(async () => {
    if (runpodLtxOperationRef.current) return;
    if (!settings.runpodKey.trim() || !settings.huggingFaceToken.trim() || !runpodCostConfirmed) return;
    runpodLtxStatusRequestSequenceRef.current += 1;
    runpodLtxOperationRef.current = true;
    setRunpodLtxBusy(true);
    setRunpodLtxStatus('validating');
    setRunpodLtxError('');
    setRunpodLtxMessage('');
    setRunpodLtxLastCheckedAt(null);
    update({ runpodLtxStatus: 'validating' });
    try {
      const selectedImageModels = [...settings.runpodLtxImageModels];
      const result = await getRunpodLtxApi().setupLtx25({
        runpodKey: settings.runpodKey.trim(),
        huggingFaceToken: settings.huggingFaceToken.trim(),
        gpuProfile: settings.runpodLtxGpuProfile,
        imageModels: selectedImageModels,
      });
      const podId = result.podId?.trim() || settings.runpodLtxPodId;
      const podUrl = result.podUrl?.trim() || settings.runpodLtxPodUrl;
      const podAuthToken = result.podAuthToken || settings.runpodLtxPodAuthToken;
      const secretIds = result.runpodLtxSecretIds || result.secretIds || settings.runpodLtxSecretIds;
      const normalized = result.ready
        ? 'ready'
        : normalizeRunpodLtxStatus(result.status, result.phase);
      const nextStatus = normalized === 'not-configured'
        ? (podId ? 'downloading' : 'creating-pod')
        : normalized;
      const activeImageModels = result.imageModels === undefined
        ? selectedImageModels
        : normalizeActiveRunpodLtxImageModels(result.imageModels) ?? selectedImageModels;
      setRunpodLtxStatus(nextStatus);
      setRunpodLtxCostPerHr(result.costPerHr ?? null);
      setRunpodLtxGpu(result.gpu || '');
      setRunpodLtxMessage(result.message?.trim() || 'RunPod created the session and is preparing its models.');
      update({
        runpodLtxPodId: podId,
        runpodLtxPodUrl: podUrl,
        runpodLtxPodAuthToken: podAuthToken,
        runpodLtxSecretIds: secretIds,
        runpodLtxActiveImageModels: activeImageModels,
        runpodLtxStatus: nextStatus,
        ...(podId ? { podId } : {}),
        ...(podUrl ? { podUrl } : {}),
      });
    } catch (cause) {
      setRunpodLtxStatus('error');
      setRunpodLtxError(friendlyRunpodLtxError(cause));
      update({ runpodLtxStatus: 'error' });
    } finally {
      runpodLtxOperationRef.current = false;
      setRunpodLtxBusy(false);
    }
  }, [runpodCostConfirmed, settings, update]);

  const terminateRunpodLtx = useCallback(async () => {
    if (runpodLtxOperationRef.current) return;
    if (!settings.runpodKey.trim() || !settings.runpodLtxPodId.trim()) return;
    runpodLtxStatusRequestSequenceRef.current += 1;
    runpodLtxOperationRef.current = true;
    setRunpodLtxBusy(true);
    setRunpodLtxStatus('terminating');
    setRunpodLtxError('');
    setRunpodLtxMessage('');
    setRunpodLtxLastCheckedAt(null);
    update({ runpodLtxStatus: 'terminating' });
    try {
      await getRunpodLtxApi().terminateLtx25({
        runpodKey: settings.runpodKey.trim(),
        podId: settings.runpodLtxPodId.trim(),
        secretIds: settings.runpodLtxSecretIds,
      });
      setRunpodLtxStatus('not-configured');
      setRunpodLtxCostPerHr(null);
      setRunpodLtxGpu('');
      setRunpodCostConfirmed(false);
      setShowRunpodEndConfirm(false);
      update({
        runpodLtxPodId: '',
        runpodLtxPodUrl: '',
        runpodLtxPodAuthToken: '',
        runpodLtxSecretIds: [],
        runpodLtxActiveImageModels: undefined,
        runpodLtxStatus: 'not-configured',
        ...(settings.podId === settings.runpodLtxPodId ? { podId: '', podUrl: '' } : {}),
        ...(settings.videoGenerationProvider === 'runpod' ? { videoGenerationProvider: DEFAULT_VIDEO_GENERATION_PROVIDER } : {}),
      });
    } catch (cause) {
      setRunpodLtxStatus('error');
      const safeError = friendlyRunpodLtxError(cause);
      setRunpodLtxError(
        /rejected|billing|account limits/i.test(safeError)
          ? safeError
          : 'RunPod did not confirm deletion. The Pod details are still saved; try ending the session again or delete it in the RunPod console.',
      );
      update({ runpodLtxStatus: 'error' });
    } finally {
      runpodLtxOperationRef.current = false;
      setRunpodLtxBusy(false);
    }
  }, [settings, update]);

  const scrollToCategory = useCallback((id: Category) => {
    setActiveCategory(id);
    const el = document.getElementById(`sp-section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleTabChange = useCallback((t: SettingsTab) => {
    setTab(t);
    setActiveCategory(t === 'app' ? 'cloud' : 'resolution');
    // scroll content to top
    contentRef.current?.scrollTo({ top: 0 });
  }, []);

  const matchingPreset = RESOLUTION_PRESETS.find(
    (p) => p.w === settings.resolutionWidth && p.h === settings.resolutionHeight,
  );
  const hasRunpodLtxPod = Boolean(settings.runpodLtxPodId);
  const runpodLtxModelChoicesLocked = hasRunpodLtxPod || runpodLtxBusy;
  const runpodLtxDisplayedImageModels = hasRunpodLtxPod
    ? settings.runpodLtxActiveImageModels ?? []
    : settings.runpodLtxImageModels;
  const runpodLtxEstimatedWeight = runpodLtxEstimatedWeightGb(runpodLtxDisplayedImageModels);

  const categories = tab === 'app' ? APP_CATEGORIES : PROJECT_CATEGORIES;

  return (
    <div className="settings-page">
      {/* ---- Sidebar ---- */}
      <aside className={`sp-sidebar${sidebarOpen ? '' : ' sp-sidebar--collapsed'}`}>
        {sidebarOpen && (
          <>
            <div className="sp-sidebar__header">
              <span className="sp-sidebar__title">Settings</span>
              <button
                className="sp-sidebar__collapse"
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
              >
                <IconChevron direction="left" />
              </button>
            </div>

            <nav className="sp-sidebar__nav">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`sp-sidebar__nav-item${activeCategory === cat.id ? ' sp-sidebar__nav-item--active' : ''}`}
                  onClick={() => scrollToCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </nav>

            <div className="sp-sidebar__footer">
              <span className="sp-sidebar__version">Timeline Studio Editor</span>
            </div>
          </>
        )}

        {!sidebarOpen && (
          <button
            className="sp-sidebar__expand"
            onClick={() => setSidebarOpen(true)}
            title="Expand sidebar"
          >
            <IconChevron direction="right" />
          </button>
        )}
      </aside>

      {/* ---- Main panel ---- */}
      <div className="sp-main">
        {/* Tab bar */}
        <div className="sp-tabs">
          <button
            className={`sp-tabs__tab${tab === 'app' ? ' sp-tabs__tab--active' : ''}`}
            onClick={() => handleTabChange('app')}
          >
            App Settings
          </button>
          <button
            className={`sp-tabs__tab${tab === 'project' ? ' sp-tabs__tab--active' : ''}`}
            onClick={() => handleTabChange('project')}
          >
            Project Settings
          </button>
        </div>

        {/* Content */}
        <div className="sp-content" ref={contentRef}>
          {tab === 'app' && (
            <div className="sp-content__inner">
              {/* --- API Keys (web: your own MuAPI and OpenAI keys) --- */}
              <section className="sp-card" id="sp-section-api-keys">
                <h3 className="sp-card__title">API Keys</h3>
                <p className="sp-card__desc">
                  Generation runs on your own keys. MuAPI powers video, music and effects; OpenAI powers chat, the Director and images (GPT Image 2.6). Keys stay in this browser.
                </p>
                <ApiKeyField
                  label="MuAPI"
                  value={muapiKey}
                  placeholder="Paste your MuAPI key…"
                  onChange={(v) => { setMuapiKey(v); void apiKeyManager.setMuapiKey(v.trim()); window.dispatchEvent(new Event('cinegen:settings-changed')); }}
                />
                <ApiKeyField
                  label="OpenAI"
                  value={openaiKey}
                  placeholder="Paste your OpenAI key…"
                  onChange={(v) => { setOpenaiKey(v); void apiKeyManager.setOpenAIKey(v.trim()); window.dispatchEvent(new Event('cinegen:settings-changed')); }}
                />
              </section>

              <section className="sp-card" id="sp-section-preferences">
                <h3 className="sp-card__title">Preferences</h3>
                <div className="sp-card__fields">
                  <div className="sp-field">
                    <label className="sp-field__label">Default Transcription Engine</label>
                    <select
                      className="sp-field__input"
                      value={settings.defaultTranscriptionEngine}
                      onChange={(e) => update({ defaultTranscriptionEngine: e.target.value as DefaultTranscriptionEngine })}
                    >
                      {TRANSCRIPTION_ENGINES.map((eng) => (
                        <option key={eng.value} value={eng.value}>{eng.label}</option>
                      ))}
                    </select>
                    <span className="sp-field__hint">
                      Used for background transcription when new audio/video is imported.
                    </span>
                  </div>
                  <div className="sp-pref-row">
                    <div>
                      <span className="sp-pref-row__label">Auto visual indexing</span>
                      <span className="sp-pref-row__hint">Keep project visual summaries warm in the background</span>
                    </div>
                    <button
                      className={`sp-switch${settings.autoVisualIndexing ? ' sp-switch--on' : ''}`}
                      onClick={() => update({ autoVisualIndexing: !settings.autoVisualIndexing })}
                      role="switch"
                      aria-checked={settings.autoVisualIndexing}
                    >
                      <span className="sp-switch__thumb" />
                    </button>
                  </div>
                  <div className="sp-pref-row">
                    <div>
                      <span className="sp-pref-row__label">Analyze new imports automatically</span>
                      <span className="sp-pref-row__hint">Queue visual indexing when video/image assets enter the media pool</span>
                    </div>
                    <button
                      className={`sp-switch${settings.analyzeVisionOnImport ? ' sp-switch--on' : ''}`}
                      onClick={() => update({ analyzeVisionOnImport: !settings.analyzeVisionOnImport })}
                      role="switch"
                      aria-checked={settings.analyzeVisionOnImport}
                    >
                      <span className="sp-switch__thumb" />
                    </button>
                  </div>
                  <div className="sp-field">
                    <label className="sp-field__label">Background Vision Model</label>
                    <select
                      className="sp-field__input"
                      value={settings.backgroundVisionModel}
                      onChange={(e) => update({ backgroundVisionModel: e.target.value })}
                    >
                      {VISION_MODEL_OPTIONS.map((model) => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
                    <span className="sp-field__hint">
                      Used by the autonomous project-wide visual indexing queue.
                    </span>
                  </div>
                  <div className="sp-field">
                    <label className="sp-field__label">Cut Vision Model</label>
                    <select
                      className="sp-field__input"
                      value={settings.cutVisionModel}
                      onChange={(e) => update({ cutVisionModel: e.target.value })}
                    >
                      {VISION_MODEL_OPTIONS.map((model) => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
                    <span className="sp-field__hint">
                      Used for higher-quality vision analysis when generating editorial cut variants.
                    </span>
                  </div>
                  <div className="sp-field">
                    <label className="sp-field__label">Max Concurrent Vision Jobs</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      className="sp-field__input"
                      value={settings.maxConcurrentVisionJobs}
                      onChange={(e) => update({
                        maxConcurrentVisionJobs: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                      })}
                    />
                    <span className="sp-field__hint">
                      Higher values index faster but use more of your OpenAI credits in parallel.
                    </span>
                  </div>
                  <div className="sp-pref-row">
                    <div>
                      <span className="sp-pref-row__label">Reduce animations</span>
                      <span className="sp-pref-row__hint">Minimize motion throughout the UI</span>
                    </div>
                    <button
                      className={`sp-switch${settings.reduceMotion ? ' sp-switch--on' : ''}`}
                      onClick={() => update({ reduceMotion: !settings.reduceMotion })}
                      role="switch"
                      aria-checked={settings.reduceMotion}
                    >
                      <span className="sp-switch__thumb" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'project' && (
            <div className="sp-content__inner">
              {/* --- Resolution --- */}
              <section className="sp-card" id="sp-section-resolution">
                <h3 className="sp-card__title">Resolution</h3>
                <p className="sp-card__desc">Default canvas size for new timelines and exports.</p>
                <div className="sp-res-presets">
                  {RESOLUTION_PRESETS.map((p) => {
                    const active = matchingPreset === p;
                    return (
                      <button
                        key={p.tag}
                        className={`sp-res-card${active ? ' sp-res-card--active' : ''}`}
                        onClick={() => update({ resolutionWidth: p.w, resolutionHeight: p.h })}
                      >
                        <span className="sp-res-card__label">{p.label}</span>
                        <span className="sp-res-card__dim">{p.w} x {p.h}</span>
                        <span className="sp-res-card__tag">{p.tag}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="sp-res-custom">
                  <div className="sp-field sp-field--inline">
                    <label className="sp-field__label">Width</label>
                    <input
                      type="number"
                      className="sp-field__input sp-field__input--narrow"
                      value={settings.resolutionWidth}
                      onChange={(e) => update({ resolutionWidth: Math.max(1, parseInt(e.target.value) || 0) })}
                      min={1}
                    />
                  </div>
                  <span className="sp-res-custom__x">x</span>
                  <div className="sp-field sp-field--inline">
                    <label className="sp-field__label">Height</label>
                    <input
                      type="number"
                      className="sp-field__input sp-field__input--narrow"
                      value={settings.resolutionHeight}
                      onChange={(e) => update({ resolutionHeight: Math.max(1, parseInt(e.target.value) || 0) })}
                      min={1}
                    />
                  </div>
                </div>
              </section>

              {/* --- Frame Rate --- */}
              <section className="sp-card" id="sp-section-frame-rate">
                <h3 className="sp-card__title">Frame Rate</h3>
                <p className="sp-card__desc">Default playback and render frame rate.</p>
                <div className="sp-fps-group">
                  {([24, 30, 60] as const).map((fr) => (
                    <button
                      key={fr}
                      className={`sp-fps-btn${settings.frameRate === fr ? ' sp-fps-btn--active' : ''}`}
                      onClick={() => update({ frameRate: fr })}
                    >
                      <span className="sp-fps-btn__num">{fr}</span>
                      <span className="sp-fps-btn__unit">fps</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* --- Aspect Ratio --- */}
              <section className="sp-card" id="sp-section-aspect-ratio">
                <h3 className="sp-card__title">Aspect Ratio</h3>
                <p className="sp-card__desc">Default aspect ratio for generated media.</p>
                <div className="sp-toggle-group">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar}
                      className={`sp-toggle-group__btn${settings.aspectRatio === ar ? ' sp-toggle-group__btn--active' : ''}`}
                      onClick={() => update({ aspectRatio: ar })}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </section>

              {/* --- About --- */}
              <section className="sp-card sp-card--muted">
                <p className="sp-card__about">
                  Timeline Studio Editor — node-based AI media generation
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
