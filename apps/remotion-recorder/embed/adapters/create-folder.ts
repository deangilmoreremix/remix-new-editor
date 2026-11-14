// Replaces src/actions/create-folder.ts.
export const createFolder = async (_folderName: string) => {
  throw new Error("Folders are managed by the editor: recordings are added to the open project.");
};
