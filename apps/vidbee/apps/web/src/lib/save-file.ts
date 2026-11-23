/**
 * Save a download to disk. Uses the File System Access API where it exists (Chromium)
 * so large files stream straight to the chosen file; otherwise falls back to a Blob link.
 */

interface SaveHandle {
	createWritable: () => Promise<WritableStream<Uint8Array> & { close: () => Promise<void> }>;
}

type PickerWindow = Window & {
	showSaveFilePicker?: (options: {
		suggestedName: string;
		types?: Array<{ description: string; accept: Record<string, string[]> }>;
	}) => Promise<SaveHandle>;
};

export const canStreamToDisk = (): boolean =>
	typeof window !== "undefined" &&
	typeof (window as PickerWindow).showSaveFilePicker === "function";

/**
 * Ask where to save. Must run in the click handler (before any await) because the
 * browser only allows the picker right after a user gesture. Returns null when
 * unsupported; throws AbortError-like errors when the user cancels.
 */
export const pickSaveTarget = async (
	suggestedName: string,
	mime: string,
	extension: string,
): Promise<SaveHandle | null> => {
	const picker = (window as PickerWindow).showSaveFilePicker;
	if (!picker) {
		return null;
	}
	return await picker.call(window, {
		suggestedName,
		types: [{ description: extension.toUpperCase(), accept: { [mime]: [`.${extension}`] } }],
	});
};

export const isCancel = (error: unknown): boolean =>
	error instanceof DOMException && error.name === "AbortError";

/** Write a fetch response to the picked file, or download it as a Blob when there is none. */
export const saveResponse = async (
	response: Response,
	filename: string,
	target: SaveHandle | null,
): Promise<void> => {
	if (target && response.body) {
		const writable = await target.createWritable();
		await response.body.pipeTo(writable);
		return;
	}
	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
};
