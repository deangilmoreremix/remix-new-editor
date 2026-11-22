import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type ConvertResult,
	type CropBox,
	type MediaInfo,
	mediaToolsSupported,
	OUTPUT_LABELS,
	type OutputKind,
	outputSupport,
	probeFile,
	type QualityName,
	runConversion,
} from "../../lib/media-tools";
import { AppShell } from "../layout/app-shell";

type Tool = "trim" | "convert" | "audio" | "resize" | "crop";

const TOOL_OUTPUTS: Record<Tool, OutputKind[]> = {
	trim: ["mp4", "webm", "wav", "ogg"],
	convert: ["mp4", "webm"],
	audio: ["wav", "ogg"],
	resize: ["mp4", "webm"],
	crop: ["mp4", "webm"],
};

const RESIZE_HEIGHTS = [0, 1080, 720, 480, 360, 240];
const ASPECTS: Array<{ label: string; value: number | undefined }> = [
	{ label: "Free", value: undefined },
	{ label: "1:1", value: 1 },
	{ label: "9:16", value: 9 / 16 },
	{ label: "16:9", value: 16 / 9 },
	{ label: "4:3", value: 4 / 3 },
];

const parseTime = (text: string): number | undefined => {
	const trimmed = text.trim();
	if (!trimmed) {
		return undefined;
	}
	const parts = trimmed.split(":").map(Number);
	if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length > 3) {
		return Number.NaN;
	}
	return parts.reduce((total, part) => total * 60 + part, 0);
};

const clock = (seconds: number): string => {
	const total = Math.max(0, seconds);
	const m = Math.floor(total / 60);
	const s = (total % 60).toFixed(1).padStart(4, "0");
	return `${m}:${s}`;
};

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Something went wrong";

/** Draw one frame of the video, rotated and flipped, so the crop box matches what Mediabunny crops. */
const grabFrame = async (
	url: string,
	atSeconds: number,
	rotate: number,
	flip: boolean,
): Promise<{ dataUrl: string; width: number; height: number }> => {
	const video = document.createElement("video");
	video.muted = true;
	video.preload = "auto";
	video.src = url;
	await new Promise<void>((resolve, reject) => {
		video.onloadeddata = () => resolve();
		video.onerror = () => reject(new Error("This browser cannot show a preview of this file."));
	});
	video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.05));
	await new Promise<void>((resolve) => {
		video.onseeked = () => resolve();
	});
	const sw = video.videoWidth;
	const sh = video.videoHeight;
	const turned = rotate === 90 || rotate === 270;
	const canvas = document.createElement("canvas");
	canvas.width = turned ? sh : sw;
	canvas.height = turned ? sw : sh;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas is not available.");
	}
	context.translate(canvas.width / 2, canvas.height / 2);
	context.rotate((rotate * Math.PI) / 180);
	if (flip) {
		context.scale(-1, 1);
	}
	context.drawImage(video, -sw / 2, -sh / 2);
	return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
};

export const ToolsPage = () => {
	const { t } = useTranslation();
	const [file, setFile] = useState<File | null>(null);
	const [info, setInfo] = useState<MediaInfo | null>(null);
	const [fileUrl, setFileUrl] = useState<string | null>(null);
	const [tool, setTool] = useState<Tool>("trim");
	const [support, setSupport] = useState<Awaited<ReturnType<typeof outputSupport>> | null>(null);
	const [output, setOutput] = useState<OutputKind>("webm");
	const [startText, setStartText] = useState("");
	const [endText, setEndText] = useState("");
	const [height, setHeight] = useState(720);
	const [quality, setQuality] = useState<QualityName>("medium");
	const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
	const [flip, setFlip] = useState(false);
	const [aspect, setAspect] = useState<number | undefined>(undefined);
	const [frame, setFrame] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [cropArea, setCropArea] = useState<Area | null>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [result, setResult] = useState<(ConvertResult & { url: string }) | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const previewRef = useRef<HTMLVideoElement>(null);

	// Unknown until mounted: the server cannot see WebCodecs, so rendering it would mismatch.
	const [supportedState, setSupportedState] = useState<boolean | null>(null);
	const supported = supportedState === true;

	useEffect(() => {
		const ok = mediaToolsSupported();
		setSupportedState(ok);
		if (ok) {
			void outputSupport().then(setSupport);
		}
	}, []);

	// Keep the chosen output valid for the selected tool and this browser.
	useEffect(() => {
		const allowed = TOOL_OUTPUTS[tool].filter((kind) => support?.[kind]?.ok !== false);
		if (!allowed.includes(output) && allowed[0]) {
			setOutput(allowed[0]);
		}
	}, [tool, support, output]);

	useEffect(
		() => () => {
			if (result) {
				URL.revokeObjectURL(result.url);
			}
		},
		[result],
	);

	const choose = async (picked: File | null) => {
		if (fileUrl) {
			URL.revokeObjectURL(fileUrl);
		}
		setResult(null);
		setError(null);
		setFrame(null);
		setInfo(null);
		setFile(picked);
		if (!picked) {
			setFileUrl(null);
			return;
		}
		setFileUrl(URL.createObjectURL(picked));
		try {
			const probed = await probeFile(picked);
			setInfo(probed);
			setEndText("");
			setStartText("");
			if (!probed.hasVideo && (tool === "resize" || tool === "crop" || tool === "convert")) {
				setTool("audio");
			}
		} catch (cause) {
			setError(messageOf(cause));
		}
	};

	// Preview frame for cropping, rotated and flipped like the output will be.
	useEffect(() => {
		if (tool !== "crop" || !fileUrl || !info?.hasVideo) {
			return;
		}
		let cancelled = false;
		void grabFrame(fileUrl, Math.min(1, info.duration / 2), rotate, flip)
			.then((next) => {
				if (!cancelled) {
					setFrame(next);
					setCrop({ x: 0, y: 0 });
					setZoom(1);
				}
			})
			.catch((cause) => !cancelled && setError(messageOf(cause)));
		return () => {
			cancelled = true;
		};
	}, [tool, fileUrl, info, rotate, flip]);

	const run = async () => {
		if (!file) {
			return;
		}
		setError(null);
		setResult(null);
		const start = parseTime(startText);
		const end = parseTime(endText);
		if (tool === "trim") {
			if (Number.isNaN(start) || Number.isNaN(end)) {
				setError("Enter times like 12.5 or 1:05.");
				return;
			}
			if (start !== undefined && end !== undefined && end <= start) {
				setError("The end must be after the start.");
				return;
			}
		}
		let cropBox: CropBox | undefined;
		if (tool === "crop") {
			if (!cropArea) {
				setError("Wait for the preview, then choose the area to keep.");
				return;
			}
			cropBox = {
				left: Math.round(cropArea.x),
				top: Math.round(cropArea.y),
				width: Math.max(2, Math.round(cropArea.width) & ~1),
				height: Math.max(2, Math.round(cropArea.height) & ~1),
			};
		}
		const controller = new AbortController();
		abortRef.current = controller;
		setProgress(0);
		try {
			const converted = await runConversion({
				file,
				output,
				trim: tool === "trim" ? { start, end } : undefined,
				audioOnly: tool === "audio",
				video:
					tool === "resize"
						? { height: height || undefined, quality }
						: tool === "crop"
							? { crop: cropBox, rotate, flip, quality }
							: tool === "convert"
								? { quality }
								: undefined,
				onProgress: setProgress,
				signal: controller.signal,
			});
			setResult({ ...converted, url: URL.createObjectURL(converted.blob) });
			toast.success(t("webTools.done", { defaultValue: "Done" }));
		} catch (cause) {
			setError(messageOf(cause));
		} finally {
			setProgress(null);
			abortRef.current = null;
		}
	};

	const allowedOutputs = useMemo(
		() => TOOL_OUTPUTS[tool].filter((kind) => support?.[kind]?.ok !== false),
		[tool, support],
	);
	const onCropComplete = useCallback((_: Area, pixels: Area) => setCropArea(pixels), []);
	const needsVideo = tool === "resize" || tool === "crop" || tool === "convert";

	const toolLabels: Record<Tool, string> = {
		trim: t("webTools.trim", { defaultValue: "Trim" }),
		convert: t("webTools.convert", { defaultValue: "Convert" }),
		audio: t("webTools.audio", { defaultValue: "Extract audio" }),
		resize: t("webTools.resize", { defaultValue: "Resize / compress" }),
		crop: t("webTools.crop", { defaultValue: "Crop & rotate" }),
	};

	return (
		<AppShell page="tools">
			<div className="h-full space-y-4 overflow-y-auto p-4 text-sm">
				<div>
					<h1 className="font-semibold text-base">
						{t("webTools.title", { defaultValue: "Video and audio tools" })}
					</h1>
					<p className="text-muted-foreground">
						{t("webTools.privacy", {
							defaultValue: "These run in your browser. Files are not uploaded.",
						})}
					</p>
				</div>

				{supportedState === false && (
					<p className="text-destructive">
						{t("webTools.unsupported", {
							defaultValue:
								"This browser does not support WebCodecs, which the tools need. Try a recent Chrome, Edge or Safari.",
						})}
					</p>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<input
						accept="video/*,audio/*"
						className="max-w-xs text-sm"
						data-testid="tools-file"
						disabled={!supported}
						onChange={(event) => void choose(event.target.files?.[0] ?? null)}
						type="file"
					/>
					{info && (
						<span className="text-muted-foreground">
							{clock(info.duration)}
							{info.width && info.height ? ` · ${info.width}×${info.height}` : ""}
							{info.videoCodec ? ` · ${info.videoCodec}` : ""}
							{info.audioCodec ? ` · ${info.audioCodec}` : ""}
						</span>
					)}
				</div>

				{file && info && (
					<>
						<div className="flex flex-wrap gap-1 border-b">
							{(Object.keys(toolLabels) as Tool[]).map((name) => (
								<button
									className={`border-b-2 px-3 py-1.5 ${
										tool === name
											? "border-primary font-medium"
											: "border-transparent text-muted-foreground"
									}`}
									disabled={TOOL_OUTPUTS[name].length > 0 && !info.hasVideo && ["resize", "crop", "convert"].includes(name)}
									key={name}
									onClick={() => setTool(name)}
									type="button"
								>
									{toolLabels[name]}
								</button>
							))}
						</div>

						{tool === "trim" && fileUrl && (
							<div className="space-y-2">
								{info.hasVideo ? (
									<video className="max-h-56 rounded-md bg-black" controls ref={previewRef} src={fileUrl}>
										<track kind="captions" />
									</video>
								) : (
									<audio controls ref={previewRef as never} src={fileUrl}>
										<track kind="captions" />
									</audio>
								)}
								<div className="flex flex-wrap items-center gap-2">
									<Input
										className="w-28"
										onChange={(event) => setStartText(event.target.value)}
										placeholder="Start 0:00"
										value={startText}
									/>
									<Button
										onClick={() => setStartText(String(previewRef.current?.currentTime.toFixed(2) ?? ""))}
										size="sm"
										variant="outline"
									>
										{t("webTools.setStart", { defaultValue: "Start = playhead" })}
									</Button>
									<Input
										className="w-28"
										onChange={(event) => setEndText(event.target.value)}
										placeholder={`End ${clock(info.duration)}`}
										value={endText}
									/>
									<Button
										onClick={() => setEndText(String(previewRef.current?.currentTime.toFixed(2) ?? ""))}
										size="sm"
										variant="outline"
									>
										{t("webTools.setEnd", { defaultValue: "End = playhead" })}
									</Button>
								</div>
							</div>
						)}

						{tool === "resize" && (
							<div className="flex flex-wrap items-center gap-3">
								<label className="flex items-center gap-2">
									{t("webTools.height", { defaultValue: "Height" })}
									<select
										className="rounded border bg-background px-2 py-1"
										onChange={(event) => setHeight(Number(event.target.value))}
										value={height}
									>
										{RESIZE_HEIGHTS.map((value) => (
											<option key={value} value={value}>
												{value ? `${value}p` : "Original"}
											</option>
										))}
									</select>
								</label>
							</div>
						)}

						{tool === "crop" && (
							<div className="space-y-2">
								<div className="flex flex-wrap items-center gap-3">
									<label className="flex items-center gap-2">
										{t("webTools.aspect", { defaultValue: "Shape" })}
										<select
											className="rounded border bg-background px-2 py-1"
											onChange={(event) =>
												setAspect(event.target.value ? Number(event.target.value) : undefined)
											}
											value={aspect ?? ""}
										>
											{ASPECTS.map((item) => (
												<option key={item.label} value={item.value ?? ""}>
													{item.label}
												</option>
											))}
										</select>
									</label>
									<label className="flex items-center gap-2">
										{t("webTools.rotate", { defaultValue: "Rotate" })}
										<select
											className="rounded border bg-background px-2 py-1"
											onChange={(event) => setRotate(Number(event.target.value) as 0 | 90 | 180 | 270)}
											value={rotate}
										>
											{[0, 90, 180, 270].map((value) => (
												<option key={value} value={value}>
													{value}°
												</option>
											))}
										</select>
									</label>
									<label className="flex items-center gap-1">
										<input checked={flip} onChange={(event) => setFlip(event.target.checked)} type="checkbox" />
										{t("webTools.flip", { defaultValue: "Mirror" })}
									</label>
								</div>
								<div className="relative h-72 w-full max-w-xl overflow-hidden rounded-md bg-black" data-testid="crop-area">
									{frame && (
										<Cropper
											aspect={aspect}
											crop={crop}
											image={frame.dataUrl}
											onCropChange={setCrop}
											onCropComplete={onCropComplete}
											onZoomChange={setZoom}
											zoom={zoom}
										/>
									)}
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center gap-3">
							<label className="flex items-center gap-2">
								{t("webTools.format", { defaultValue: "Format" })}
								<select
									className="rounded border bg-background px-2 py-1"
									onChange={(event) => setOutput(event.target.value as OutputKind)}
									value={output}
								>
									{allowedOutputs.map((kind) => (
										<option key={kind} value={kind}>
											{OUTPUT_LABELS[kind]}
										</option>
									))}
								</select>
							</label>
							{needsVideo && (
								<label className="flex items-center gap-2">
									{t("webTools.quality", { defaultValue: "Quality" })}
									<select
										className="rounded border bg-background px-2 py-1"
										onChange={(event) => setQuality(event.target.value as QualityName)}
										value={quality}
									>
										<option value="low">Low (small file)</option>
										<option value="medium">Medium</option>
										<option value="high">High</option>
									</select>
								</label>
							)}
							{progress === null ? (
								<Button disabled={!supported || (needsVideo && !info.hasVideo)} onClick={() => void run()} size="sm">
									{t("webTools.run", { defaultValue: "Run" })}
								</Button>
							) : (
								<Button onClick={() => abortRef.current?.abort()} size="sm" variant="outline">
									{t("webTools.cancel", { defaultValue: "Cancel" })}
								</Button>
							)}
							{progress !== null && (
								<span className="tabular-nums" data-testid="tools-progress">
									{Math.round(progress * 100)}%
								</span>
							)}
						</div>
						{support?.[output]?.note && (
							<p className="text-muted-foreground text-xs">{support[output]?.note}</p>
						)}
					</>
				)}

				{error && (
					<p className="text-destructive" data-testid="tools-error">
						{error}
					</p>
				)}

				{result && (
					<div className="space-y-2 rounded-md border p-3" data-testid="tools-result">
						{result.notes.map((note) => (
							<p className="text-muted-foreground text-xs" key={note}>
								{note}
							</p>
						))}
						{result.blob.type.startsWith("video/") ? (
							<video className="max-h-56 rounded-md bg-black" controls src={result.url}>
								<track kind="captions" />
							</video>
						) : (
							<audio controls src={result.url}>
								<track kind="captions" />
							</audio>
						)}
						<div className="flex items-center gap-3">
							<a
								className="rounded-md border px-3 py-1.5 font-medium hover:bg-muted"
								download={result.filename}
								href={result.url}
							>
								{t("webTools.download", { defaultValue: "Download" })} {result.filename}
							</a>
							<span className="text-muted-foreground text-xs">
								{(result.blob.size / 1024).toFixed(0)} KB
							</span>
						</div>
					</div>
				)}

				<p className="text-muted-foreground text-xs">
					{t("webTools.more", { defaultValue: "More online tools:" })}{" "}
					<a className="underline" href="https://vidbee.org/tools/" rel="noopener noreferrer" target="_blank">
						vidbee.org/tools
					</a>
				</p>
			</div>
		</AppShell>
	);
};
