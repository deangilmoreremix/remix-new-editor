import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BlinkingCircle } from "./BlinkingCircle";
import type { RecordingStatus } from "./RecordButton";
import { RecordButton } from "./RecordButton";
import { Timer } from "./Timer";
import { fetchProjectFolders } from "./actions/fetch-project-folders";
import { NewFolderDialog } from "./components/NewFolderDialog";
import { ProcessStatus, ProcessingStatus } from "./components/ProcessingStatus";
import { SelectedFolder } from "./components/SelectedFolder";
import { UseThisTake } from "./components/UseThisTake";
import { Button } from "./components/ui/button";
import {
  loadFolderFromUrl,
  loadSelectedFolder,
  persistSelectedFolder,
} from "./helpers/get-folders";

const topBarContainer: React.CSSProperties = {
  display: "flex",
  gap: 10,
  margin: 10,
  alignItems: "center",
  flexDirection: "row",
  flexWrap: "wrap", // on a phone the folder picker and "Edit video" drop to the next line instead of leaving the screen
  justifyContent: "center",
};

const recordWrapper: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
};

export const TopBar: React.FC<{
  recordingStatus: RecordingStatus;
  setRecordingStatus: React.Dispatch<React.SetStateAction<RecordingStatus>>;
  showAllViews: boolean;
  /** Opens the project in the studio's editor (Recorder linked to Remotion Studio). */
  onOpenProject?: (folder: string) => void;
  /** Folder to start on, e.g. the one the studio is editing. */
  initialFolder?: string | null;
}> = ({ recordingStatus, setRecordingStatus, showAllViews, onOpenProject, initialFolder }) => {
  const [folders, setFolders] = useState<string[] | null>(null);
  const [processingStatus, setProcessingStatus] =
    useState<ProcessStatus | null>(null);

  const folderFromUrl: string | null = useMemo(() => {
    return initialFolder ?? loadFolderFromUrl();
  }, [initialFolder]);

  const [preferredSelectedFolder, setSelectedFolder] = useState<string | null>(
    folderFromUrl ?? loadSelectedFolder(),
  );

  const selectedFolder = useMemo(() => {
    return preferredSelectedFolder ?? folders?.[0] ?? null;
  }, [folders, preferredSelectedFolder]);

  const refreshFoldersList = useCallback(async () => {
    const json = await fetchProjectFolders();
    setFolders(json.folders);
  }, []);

  useEffect(() => {
    refreshFoldersList();
  }, [refreshFoldersList]);

  useEffect(() => {
    persistSelectedFolder(selectedFolder ?? "");
  }, [selectedFolder]);

  return (
    <div style={topBarContainer}>
      <div style={recordWrapper}>
        <RecordButton
          recordingStatus={recordingStatus}
          processingStatus={processingStatus}
          setRecordingStatus={setRecordingStatus}
          showAllViews={showAllViews}
        />
        {recordingStatus.type === "recording" ? (
          <>
            <BlinkingCircle />
            <Timer startDate={recordingStatus.ongoing.startDate} />
          </>
        ) : null}
        {recordingStatus.type === "recording-finished" ? (
          <UseThisTake
            selectedFolder={selectedFolder}
            recordingStatus={recordingStatus}
            setRecordingStatus={setRecordingStatus}
            setStatus={setProcessingStatus}
          />
        ) : null}
        {processingStatus && (
          <ProcessingStatus status={processingStatus}></ProcessingStatus>
        )}
      </div>

      <div style={{ flex: 1 }} />
      {folders ? (
        <>
          <SelectedFolder
            folders={folders}
            selectedFolder={selectedFolder}
            setSelectedFolder={setSelectedFolder}
          />
          <NewFolderDialog
            refreshFoldersList={refreshFoldersList}
            setSelectedFolder={setSelectedFolder}
          />
        </>
      ) : null}
      {onOpenProject && selectedFolder ? (
        <Button variant="outline" onClick={() => onOpenProject(selectedFolder)} data-recorder="open-project">
          Edit video
        </Button>
      ) : null}
    </div>
  );
};
