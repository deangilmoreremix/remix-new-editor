// [remix] Design harness: renders CineGen's real components in our theme so screens can be reviewed before wiring.
import { createRoot } from 'react-dom/client';
import '@cinegen/styles/globals.css';
import '@cinegen/styles/edit-tab.css';
import '@cinegen/styles/director-tab.css';
import '@cinegen/styles/theme-remix.css';
import { WorkspaceProvider } from '@cinegen/components/workspace/workspace-shell';
import { ElementsTab } from '@cinegen/components/elements/elements-tab';

const screen = new URLSearchParams(location.search).get('screen') || 'elements';
const demoElements = [
  { id: 'e1', name: 'David Besh', type: 'character', description: 'Mid-40s, tan jacket, green tee', images: [], createdAt: '', updatedAt: '' },
  { id: 'e2', name: 'Rooftop', type: 'location', description: 'City rooftop at dusk', images: [], createdAt: '', updatedAt: '' },
  { id: 'e3', name: 'Hazmat suit', type: 'prop', description: 'Yellow suit', images: [], createdAt: '', updatedAt: '' },
  { id: 'e4', name: 'Sedan', type: 'vehicle', description: 'Dusty 90s sedan', images: [], createdAt: '', updatedAt: '' },
] as never[];

function App() {
  return (
    <div className="cinegen-root" style={{ height: '100vh', background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
      <WorkspaceProvider init={(s) => ({ ...s, elements: demoElements })}>
        {screen === 'elements' && <ElementsTab />}
      </WorkspaceProvider>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
