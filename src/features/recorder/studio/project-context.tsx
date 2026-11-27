// Recorder reads the project folder from the composition id (`useVideoConfig().id`), which is
// the folder name in Remotion Studio. The Player and the web renderer use their own ids, so the
// browser studio passes the folder through this context instead.
import React, { createContext, useContext } from "react";
import { useRemotionEnvironment, useVideoConfig } from "remotion";

type ProjectContext = { projectId: string; editing: boolean };
const ProjectIdContext = createContext<ProjectContext | null>(null);

/**
 * `editing` turns on the in-video editing tools Recorder shows only in Remotion Studio
 * (scene actions, caption editor). The studio's preview Player sets it; exports do not.
 */
export const ProjectIdProvider: React.FC<{
  projectId: string;
  editing?: boolean;
  children: React.ReactNode;
}> = ({ projectId, editing = false, children }) => (
  <ProjectIdContext.Provider value={{ projectId, editing }}>{children}</ProjectIdContext.Provider>
);

export const useProjectId = (): string => {
  const fromContext = useContext(ProjectIdContext);
  const { id } = useVideoConfig();
  return fromContext?.projectId ?? id;
};

/** Stands in for `useRemotionEnvironment().isStudio` in Recorder's editing tools. */
export const useIsEditing = (): boolean => {
  const fromContext = useContext(ProjectIdContext);
  const env = useRemotionEnvironment();
  if (env.isRendering) return false;
  return env.isStudio || Boolean(fromContext?.editing);
};
