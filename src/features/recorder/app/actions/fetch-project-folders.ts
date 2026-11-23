// Browser version: project folders come from the in-browser project store, not the local server.
import { listFolders, loadProjectStore } from "../../studio/project-store";

export const fetchProjectFolders = async () => {
  await loadProjectStore();
  return { folders: listFolders() };
};
