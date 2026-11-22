import { toBlob } from "html-to-image";

/** Render a DOM node to a PNG. Runs in the page; nothing is uploaded. */
export const renderNodeToPng = async (node: HTMLElement): Promise<Blob> => {
	const background = getComputedStyle(document.body).backgroundColor || "#ffffff";
	const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: background, cacheBust: true });
	if (!blob) {
		throw new Error("The image could not be created.");
	}
	return blob;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
};

export const canCopyImage = (): boolean =>
	typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);

export const copyImage = async (blob: Blob): Promise<void> => {
	await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
};

/** True when the system share sheet can take an image file (mostly phones and some desktops). */
export const canShareImage = (filename: string, blob: Blob): boolean => {
	if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
		return false;
	}
	return navigator.canShare({ files: [new File([blob], filename, { type: "image/png" })] });
};

export const shareImage = async (blob: Blob, filename: string, title: string): Promise<void> => {
	await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title });
};
