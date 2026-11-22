const KEY = "remotionrecorder.selectedFolder";

// The studio passes the folder in (Recorder read ?folder= from the URL).
export const loadFolderFromUrl = (): string | null => null;

export const loadSelectedFolder = () => {
  const projectFromLS = window.localStorage.getItem(KEY);
  if (projectFromLS === "") {
    return null;
  }

  return projectFromLS;
};

export const persistSelectedFolder = (folder: string) => {
  window.localStorage.setItem(KEY, folder);
};
