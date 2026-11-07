// [remix] Design harness: renders CineGen's real components in our theme so screens can be reviewed before wiring.
import { createRoot } from 'react-dom/client';
import '@cinegen/styles/globals.css';
import '@cinegen/styles/edit-tab.css';
import '@cinegen/styles/director-tab.css';
import '@cinegen/styles/theme-remix.css';
import { installElectronShim } from '@cinegen/adapters/electron-shim';
import { registerWebApi } from '@cinegen/adapters/web-api';
installElectronShim();
registerWebApi();
import { useWorkspace, WorkspaceProvider } from '@cinegen/components/workspace/workspace-shell';
import { ElementsTab } from '@cinegen/components/elements/elements-tab';
import { EditTab } from '@cinegen/components/edit/edit-tab';
import { DirectorTab } from '@cinegen/components/director/director-tab';
import { CreateTab } from '@cinegen/components/create/create-tab';
import { LLMTab } from '@cinegen/components/llm/llm-tab';
import { ExportTab } from '@cinegen/components/export/export-tab';

const screen = new URLSearchParams(location.search).get('screen') || 'elements';
const demoElements = [
  { id: 'e1', name: 'David Besh', type: 'character', description: 'Mid-40s, tan jacket, green tee', images: [], createdAt: '', updatedAt: '' },
  { id: 'e2', name: 'Rooftop', type: 'location', description: 'City rooftop at dusk', images: [], createdAt: '', updatedAt: '' },
  { id: 'e3', name: 'Hazmat suit', type: 'prop', description: 'Yellow suit', images: [], createdAt: '', updatedAt: '' },
  { id: 'e4', name: 'Sedan', type: 'vehicle', description: 'Dusty 90s sedan', images: [], createdAt: '', updatedAt: '' },
] as never[];

function LlmScreen() {
  const { state, projectId } = useWorkspace();
  const noop = () => undefined;
  return (
    <LLMTab
      projectId={projectId}
      assets={state.assets}
      mediaFolders={state.mediaFolders}
      timelines={state.timelines}
      activeTimelineId={state.activeTimelineId}
      elements={state.elements}
      onCreateTimelineFromCut={noop as never}
      onOpenTimeline={noop as never}
      onNavigateToAssetCitation={noop as never}
      onNavigateToTimelineCitation={noop as never}
      onUpdateAssetAnalysis={noop as never}
      openSkillBuilderSignal={0 as never}
      onActiveSkillPresenceChange={noop as never}
      isTabActive
      onCopilotThinkingChange={noop as never}
      onCopilotResponseReadyWhileBackgrounded={noop as never}
    />
  );
}

const now = new Date().toISOString();
const DEMO = '/cinegen-demo/';
function seedEdit(s: any) {
  const tl = s.timelines[0];
  const v1 = tl.tracks.find((t: any) => t.name === 'V1').id;
  const a1 = tl.tracks.find((t: any) => t.name === 'A1').id;
  const assets = [1, 2, 3].map((i) => ({ id: `v${i}`, name: `Storyboard shot ${i}`, type: 'video', url: `${DEMO}clip${i}.mp4`, thumbnailUrl: `${DEMO}thumb${i}.jpg`, duration: 5, width: 1280, height: 720, createdAt: now, status: 'online', metadata: { llmVisualSummaryStatus: 'ready' } }));
  assets.push({ id: 'm1', name: 'Score', type: 'audio', url: `${DEMO}music.mp3`, duration: 12, createdAt: now, status: 'online' } as never);
  const clips = [0, 1, 2].map((i) => ({ id: `c${i}`, assetId: `v${i + 1}`, trackId: v1, name: `Storyboard shot ${i + 1}`, startTime: i === 2 ? 12 : i * 5, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [] }));
  clips.push({ id: 'ca', assetId: 'm1', trackId: a1, name: 'Score', startTime: 0, duration: 12, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [] });
  return { ...s, assets, timelines: [{ ...tl, clips, duration: 17 }] };
}
const seeds: Record<string, (s: any) => any> = { edit: seedEdit };

function App() {
  return (
    <div className="cinegen-root" style={{ height: '100vh', background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
      <WorkspaceProvider init={(s) => { const base = { ...s, elements: demoElements }; return (seeds[screen] ? seeds[screen](base) : base) as never; }}>
        {screen === 'elements' && <ElementsTab />}
        {screen === 'edit' && <EditTab llmJumpRequest={null as never} />}
        {screen === 'director' && <DirectorTab />}
        {screen === 'spaces' && <CreateTab />}
        {screen === 'llm' && <LlmScreen />}
        {screen === 'export' && <ExportTab />}
      </WorkspaceProvider>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
