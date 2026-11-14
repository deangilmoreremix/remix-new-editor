// Replaces src/actions/fetch-project-folders.ts: the editor has exactly one "folder", its open project.
import { EDITOR_FOLDER } from "./bridge";

export const fetchProjectFolders = async () => ({ folders: [EDITOR_FOLDER] });
