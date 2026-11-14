// Replaces src/helpers/upload-file.ts: instead of POSTing a converted take to the Bun server, hand it to the editor.
import { getExtension } from "../../src/helpers/find-good-supported-codec";
import { inEditor, toParent } from "./bridge";

// Kept for API compatibility with the module it replaces.
export const parseJsonOrThrowSource = (data: Uint8Array, type: string) => {
  const asString = new TextDecoder("utf-8").decode(data);
  try {
    return JSON.parse(asString);
  } catch {
    throw new Error(`Invalid JSON (${type}): ${asString}`);
  }
};

export const uploadFileToServer = async ({
  blob,
  endDate,
  prefix,
  selectedFolder,
  expectedFrames,
  mimeType,
}: {
  blob: Blob;
  endDate: number;
  prefix: string;
  selectedFolder: string;
  expectedFrames: number;
  mimeType: string;
}) => {
  if (!inEditor()) {
    // Opened on its own (not inside the editor): keep the take as a download rather than losing it.
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${prefix}${endDate}.${getExtension(mimeType)}`;
    a.click();
    return;
  }
  toParent({ type: "file", prefix, endDate, expectedFrames, mimeType, folder: selectedFolder, blob });
};
