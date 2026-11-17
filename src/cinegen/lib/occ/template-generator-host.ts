// [remix] What the new editor offers the Template Generator wizard, kept out of timeline-editor.tsx so that file stays close to CineGen's own:
// the editor's own libraries and GL transitions, the project's media ("My media"), and exporting the template as a video on its own.
import type { Asset } from '@cinegen/types/project';
import { buildGeneratorSources, generatorTransitions } from '@cinegen/lib/occ/template-generator-sources';
import { applyComposition, type Composition } from '@cinegen/lib/occ/template-composition';
import { buildExportArgs } from '@cinegen/lib/occ/export-args';
import { createDefaultTimeline } from '@cinegen/lib/editor/timeline-operations';

export function generatorHostOptions(assets: Asset[]) {
  return {
    // Animations, motion graphics and end screens from this editor's own libraries (plus Pexels, Pixabay and upload built into the wizard)
    extraSources: buildGeneratorSources(),
    // the editor's own GL transitions (what the timeline really renders) and the animated lower-third styles, in categories
    transitions: generatorTransitions(),
    lowerThirdStyles: true,
    // "My media": the project's own clips and images
    projectMedia: assets
      .filter((x) => x.type === 'video' || x.type === 'image')
      .map((x) => ({ id: x.id, type: x.type, name: x.name, url: x.url, duration: x.duration, thumbnail: x.thumbnailUrl ?? x.url, width: x.width, height: x.height })),
    // Export the template as a video, on its own (not the user's project): built on an empty timeline and rendered in this browser
    exportVideo: async ({ composition, onProgress }: { composition: Composition; onProgress?: (p: number) => void }) => {
      const applied = applyComposition(createDefaultTimeline('Template'), composition);
      let job = await window.electronAPI.export.start(buildExportArgs(applied.timeline, applied.assets, applied.overlays, { preset: 'standard', fps: 30 }));
      while (job.status === 'rendering' || job.status === 'queued') {
        await new Promise((r) => setTimeout(r, 1000));
        job = await window.electronAPI.export.poll(job.id);
        onProgress?.((job.progress ?? 0) / 100);
      }
      if (job.status === 'failed') throw new Error(job.error || 'The export failed');
      // this video only exists in this tab (a blob: file), so tell the AI Captions picker about it for as long as the page is open
      if (job.outputUrl) void import('../../../components/modals/ai-captions/library.js').then((m) => m.announceVideo({ url: job.outputUrl, title: 'Template Generator video', studio: 'template-generator' })).catch(() => {});
      return { filename: 'cinegen-export.mp4', fileSize: job.fileSize ?? 0, url: job.outputUrl };
    },
    // "Add to Video Pages": the app's one landing page picker (src/lib/landingPages/pickerModal.js) with the rendered video attached. It lists the
    // designs, opens the chosen one in the visual editor with the video in it, and "Save as my page" uploads the video (a local blob: file is copied
    // to storage) and creates the draft. It opens above this window (9999), and `onPick` hears about the saved page.
    addToVideoPages: async (video: { url: string; title: string; fileSize?: number; duration?: number | null }, opts: { onPick?: (saved: { id?: string; url?: string; published?: boolean }) => void } = {}) => {
      const { openLandingPagePicker } = await import('../../../lib/landingPages/pickerModal.js');
      openLandingPagePicker({
        video: { url: video.url, name: video.title, ...(video.duration != null ? { duration: video.duration } : {}), studio: 'template-generator' },
        zIndex: 10050,
        onPick: opts.onPick,
      });
    },
  };
}
