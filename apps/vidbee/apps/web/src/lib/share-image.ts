import { toBlob } from "html-to-image";

/** Render a DOM node to a PNG and download it. Runs in the page; nothing is uploaded. */
export const saveNodeAsPng = async (node: HTMLElement, filename: string): Promise<Blob> => {
	const background = getComputedStyle(document.body).backgroundColor || "#ffffff";
	const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: background, cacheBust: true });
	if (!blob) {
		throw new Error("The image could not be created.");
	}
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
	return blob;
};
