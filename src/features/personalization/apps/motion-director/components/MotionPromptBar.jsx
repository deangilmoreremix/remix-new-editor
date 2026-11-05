'use client';

import { useCallback, useRef, useState } from 'react';
import {
  PromptComposer,
  PromptTextarea,
  PromptControls,
  PromptFooter,
  PromptAction,
  PromptPopover,
  PromptPopoverHeader,
  PromptMenuList,
  PromptMenuItem,
  PromptAspectRatioIcon,
  PromptDurationIcon,
  promptControlClassName,
  promptMediaButtonClassName,
  PROMPT_MEDIA_PREVIEW_CLASS,
} from '../../../packages/studio/src/components/prompt/PromptComposer';
import { prepareMedia, attachMediaAttachments } from '../lib/mediaUpload';

const ASPECT_RATIOS = ['16:9', '9:16', '1:1'];
const DURATIONS = [5, 6, 8, 10, 12, 15, 20, 25, 30];

/**
 * 素材缩略图：图片 / 视频直接用本地 object URL 预览，音频画一个音符。
 * 上游 `PROMPT_MEDIA_PREVIEW_CLASS` 是圆形缩略图容器（Video Studio 同款）。
 */
const MediaThumb = ({ attachment }) => (
  <div className={PROMPT_MEDIA_PREVIEW_CLASS} title={attachment.name} data-testid="motion-prompt-media-thumb">
    {attachment.kind === 'image' ? (
      <img src={attachment.url} alt={attachment.name} className="w-full h-full object-cover" />
    ) : attachment.kind === 'video' ? (
      <video src={attachment.url} className="w-full h-full object-cover" muted playsInline />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-white/5 text-[#22d3ee]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      </div>
    )}
  </div>
);

/**
 * 提示词输入条 —— Video Studio 同款的 `<PromptComposer>` 根组件 + 本地素材接入。
 *
 * 素材链路：选文件 → `prepareMedia()`（浏览器本地 object URL，不上传、不调任何
 * 外部 / 付费 API）→ `attachMediaAttachments()` 落成工程里的媒体片段
 * （image-clip / video-clip / audio-clip），Remotion 合成随即重渲染。
 */
export default function MotionPromptBar({
  value = '',
  onChange = (..._args) => {},
  aspectRatio = '16:9',
  onAspectRatioChange = (..._args) => {},
  duration = 5,
  onDurationChange = (..._args) => {},
  generating = false,
  onGenerate = (..._args) => {},
  /** 素材准备好后的回调（入口页用它把素材带进新工程） */
  onMediaChange = (..._args) => {},
  /**
   * 选中文件后是否直接落进当前工程。
   * 工作台里要（素材即刻变成时间轨上的片段）；入口页不要——它自己
   * 在「Create」时把素材接进新工程（见 MotionStudioEntry），开着会重复接入。
   */
  autoAttach = true,
}) {
  const [ratioOpen, setRatioOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [media, setMedia] = useState([]);
  const fileRef = useRef(null);

  const handleGenerate = useCallback(() => {
    if (!value.trim() || generating) return;
    onGenerate?.({ prompt: value, aspectRatio, duration });
  }, [value, aspectRatio, duration, generating, onGenerate]);

  /** 选中的本地素材 → object URL → 直接落进当前工程 */
  const handleFiles = useCallback(
    (event) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!files.length) return;
      const prepared = prepareMedia(files);
      if (!prepared.length) return;
      if (autoAttach) attachMediaAttachments(prepared);
      setMedia((prev) => [...prev, ...prepared]);
      onMediaChange?.(prepared);
    },
    [autoAttach, onMediaChange],
  );

  return (
    <PromptComposer positionClassName="relative w-full animate-fade-in-up">
      <PromptTextarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Describe your motion video..."
        disabled={generating}
      />

      {media.length > 0 && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {media.map((m) => (
            <MediaThumb key={m.id} attachment={m} />
          ))}
        </div>
      )}

      <PromptControls className="pt-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={generating}
          className={`${promptMediaButtonClassName()} disabled:cursor-not-allowed disabled:opacity-50`}
          title="Attach image / video / audio"
          aria-label="Attach media"
          data-testid="motion-prompt-media-button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-white/40 group-hover:text-[#22d3ee] transition-colors"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          hidden
          onChange={handleFiles}
          aria-label="Attach media files"
          data-testid="motion-prompt-media-input"
        />
        <button
          type="button"
          onClick={() => setRatioOpen((o) => !o)}
          disabled={generating}
          className={promptControlClassName({ active: ratioOpen })}
        >
          <PromptAspectRatioIcon className="mr-1.5" />
          <span className="text-xs font-semibold text-white/90">{aspectRatio}</span>
        </button>
        {ratioOpen && (
          <PromptPopover className="w-[150px]">
            <PromptPopoverHeader>Aspect Ratio</PromptPopoverHeader>
            <PromptMenuList>
              {ASPECT_RATIOS.map((ratio) => (
                <PromptMenuItem
                  key={ratio}
                  onClick={() => {
                    setRatioOpen(false);
                    onAspectRatioChange?.(ratio);
                  }}
                  selected={ratio === aspectRatio}
                >
                  {ratio}
                </PromptMenuItem>
              ))}
            </PromptMenuList>
          </PromptPopover>
        )}
        <button
          type="button"
          onClick={() => setDurationOpen((o) => !o)}
          disabled={generating}
          className={promptControlClassName({ active: durationOpen })}
        >
          <PromptDurationIcon className="mr-1.5" />
          <span className="text-xs font-semibold text-white/90">{duration}s</span>
        </button>
        {durationOpen && (
          <PromptPopover className="w-[120px]">
            <PromptPopoverHeader>Duration</PromptPopoverHeader>
            <PromptMenuList>
              {DURATIONS.map((d) => (
                <PromptMenuItem
                  key={d}
                  onClick={() => {
                    setDurationOpen(false);
                    onDurationChange?.(d);
                  }}
                  selected={d === duration}
                >
                  {d}s
                </PromptMenuItem>
              ))}
            </PromptMenuList>
          </PromptPopover>
        )}
      </PromptControls>
      <PromptFooter>
        <span className="text-xs text-white/40">{value.length} characters</span>
        <PromptAction
          onClick={handleGenerate}
          disabled={generating || !value.trim()}
        >
          {generating ? 'Creating...' : 'Generate'}
        </PromptAction>
      </PromptFooter>
    </PromptComposer>
  );
}
