// Browser version: a project is created in the in-browser project store.
import { emptyProjectProps } from "../../studio/project-defaults";
import { createFolder as createProjectFolder, loadProjectStore } from "../../studio/project-store";

export const createFolder = async (folderName: string) => {
  await loadProjectStore();
  await createProjectFolder(folderName, emptyProjectProps());
  return { success: true, message: `Project "${folderName}" created.` };
};
