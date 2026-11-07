// [remix] The CineGen workspace as a web page: CineGen's own tabs + TopTabs inside our provider.
// Replaces CineGen's Electron-only WorkspaceShell (project manager, cloud sync, MCP bridge).
import { useCallback, useState } from 'react';
import type { ProjectTab } from '@cinegen/types/workspace';
import { WorkspaceProvider, useWorkspace } from './workspace-shell';
import { TopTabs } from './top-tabs';
import { ElementsTab } from '@cinegen/components/elements/elements-tab';
import { CreateTab } from '@cinegen/components/create/create-tab';
import { EditTab } from '@cinegen/components/edit/edit-tab';
import { DirectorTab } from '@cinegen/components/director/director-tab';
import { LLMTab } from '@cinegen/components/llm/llm-tab';
import { ExportTab } from '@cinegen/components/export/export-tab';

function Tabs({ onBack }: { onBack?: () => void }) {
  const { state, dispatch, projectId } = useWorkspace();
  const [llmThinking, setLlmThinking] = useState(false);
  const [unread, setUnread] = useState(false);
  const noop = useCallback(() => undefined, []);
  const onTab = useCallback((tab: ProjectTab) => {
    if (tab === 'llm') setUnread(false);
    dispatch({ type: 'SET_TAB', tab });
  }, [dispatch]);
  return (
    <>
      <TopTabs
        activeTab={state.activeTab}
        onTabChange={onTab}
        onBackToHome={onBack}
        showSkillsButton={false}
        llmCopilotStatus={{ isThinking: llmThinking, hasUnreadResponse: unread }}
      />
      <main className="workspace-content">
        {state.activeTab === 'elements' && <ElementsTab />}
        {state.activeTab === 'create' && <CreateTab />}
        {state.activeTab === 'director' && <DirectorTab />}
        {state.activeTab === 'edit' && <EditTab llmJumpRequest={null} />}
        <div className={`workspace-tab-panel${state.activeTab === 'llm' ? ' workspace-tab-panel--active' : ''}`}>
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
            isTabActive={state.activeTab === 'llm'}
            onCopilotThinkingChange={setLlmThinking}
            onCopilotResponseReadyWhileBackgrounded={() => setUnread(true)}
          />
        </div>
        {state.activeTab === 'export' && <ExportTab />}
      </main>
    </>
  );
}

export function WebWorkspace({ projectId = 'timeline-editor', onBack }: { projectId?: string; onBack?: () => void }) {
  return (
    <div className="cinegen-root" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', flexDirection: 'column' }}>
      <WorkspaceProvider projectId={projectId}>
        <Tabs onBack={onBack} />
      </WorkspaceProvider>
    </div>
  );
}
