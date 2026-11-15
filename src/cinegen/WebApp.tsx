import { useCallback, useEffect, useState } from 'react';
import { HomeView } from '@cinegen/components/home/home-view';
import { WorkspaceShell } from '@cinegen/components/workspace/workspace-shell';
import './styles/globals.css';

interface OpenProject {
  id: string;
  useSqlite: boolean;
}

function projectFromLocation(): OpenProject | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('project');
  if (!id) return null;
  return { id, useSqlite: params.get('storage') !== 'json' };
}

function replaceProjectLocation(project: OpenProject | null) {
  const url = new URL(window.location.href);
  if (project) {
    url.searchParams.set('project', project.id);
    url.searchParams.set('storage', project.useSqlite ? 'db' : 'json');
  } else {
    url.searchParams.delete('project');
    url.searchParams.delete('storage');
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function WebApp() {
  const [openProject, setOpenProject] = useState<OpenProject | null>(projectFromLocation);

  useEffect(() => {
    const handlePopState = () => setOpenProject(projectFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenProject = useCallback((id: string, useSqlite: boolean) => {
    const project = { id, useSqlite };
    replaceProjectLocation(project);
    setOpenProject(project);
  }, []);

  // [remix] The Projects overview (also shown inside an open project) asks the app to switch projects.
  useEffect(() => {
    const open = (e: Event) => { const id = (e as CustomEvent<{ id?: string }>).detail?.id; if (id) handleOpenProject(id, true); };
    window.addEventListener('remix:cinegen-open-project', open);
    return () => window.removeEventListener('remix:cinegen-open-project', open);
  }, [handleOpenProject]);

  const handleBackToHome = useCallback(() => {
    replaceProjectLocation(null);
    setOpenProject(null);
  }, []);

  return (
    <div className="app-root">
      {openProject ? (
        <WorkspaceShell
          key={openProject.id}
          projectId={openProject.id}
          useSqlite={openProject.useSqlite}
          onBackToHome={handleBackToHome}
        />
      ) : (
        <HomeView onOpenProject={handleOpenProject} />
      )}
    </div>
  );
}
