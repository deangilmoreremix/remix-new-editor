import type { DownloadTask } from "@smartvid/downloader-core";

export type DownloadRecord = DownloadTask & {
	entryType: "active" | "history";
};
