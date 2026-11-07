// [remix] Design harness: renders CineGen's real components in our theme so screens can be reviewed before wiring.
import { createRoot } from 'react-dom/client';
import '@cinegen/styles/globals.css';
import '@cinegen/styles/edit-tab.css';
import '@cinegen/styles/director-tab.css';
import '@cinegen/styles/theme-remix.css';
import { installElectronShim } from '@cinegen/adapters/electron-shim';
installElectronShim();
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

function App() {
  return (
    <div className="cinegen-root" style={{ height: '100vh', background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
      <WorkspaceProvider init={(s) => ({ ...s, elements: demoElements })}>
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
