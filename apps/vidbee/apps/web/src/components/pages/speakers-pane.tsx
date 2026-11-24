import type { WebTranscriptDetail } from "@vidbee/transcription/web-contract";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type Record = NonNullable<WebTranscriptDetail["record"]>;

export const SPEAKER_STYLES = [
	{ bar: "bg-sky-500", avatar: "bg-sky-500/15 text-sky-600", name: "text-sky-600" },
	{ bar: "bg-emerald-500", avatar: "bg-emerald-500/15 text-emerald-600", name: "text-emerald-600" },
	{ bar: "bg-violet-500", avatar: "bg-violet-500/15 text-violet-600", name: "text-violet-600" },
	{ bar: "bg-amber-500", avatar: "bg-amber-500/15 text-amber-600", name: "text-amber-600" },
	{ bar: "bg-rose-500", avatar: "bg-rose-500/15 text-rose-600", name: "text-rose-600" },
	{ bar: "bg-cyan-500", avatar: "bg-cyan-500/15 text-cyan-600", name: "text-cyan-600" },
] as const;

export const speakerStyle = (index: number) =>
	SPEAKER_STYLES[Math.max(0, index) % SPEAKER_STYLES.length] as (typeof SPEAKER_STYLES)[number];

const initials = (name: string): string =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("") || "?";

export const SpeakerAvatar = ({ name, index }: { name: string; index: number }) => (
	<span
		className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full font-medium text-[10px] ${speakerStyle(index).avatar}`}
	>
		{initials(name)}
	</span>
);

export const formatClock = (ms: number): string => {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

/** Talk time per speaker, with each speaker's turns placed on a shared timeline. */
export const SpeakersPane = ({
	record,
	activeSpeakerId,
	onSeek,
}: {
	record: Record;
	activeSpeakerId: string | null;
	onSeek: (ms: number) => void;
}) => {
	const { t } = useTranslation();
	const stats = useMemo(() => {
		const segments = record.segments;
		const timelineMs = Math.max(1, ...segments.map((segment) => segment.endMs));
		const rows = record.speakers.map((speaker, index) => {
			const turns = segments.filter((segment) => segment.speakerId === speaker.id);
			const talkMs = turns.reduce((sum, segment) => sum + Math.max(0, segment.endMs - segment.startMs), 0);
			return { speaker, index, turns, talkMs };
		});
		const totalTalk = rows.reduce((sum, row) => sum + row.talkMs, 0) || 1;
		return { timelineMs, totalTalk, rows };
	}, [record]);

	if (record.speakers.length === 0) {
		return (
			<p className="p-4 text-muted-foreground text-sm">
				{t("webTranscripts.speakers.none", {
					defaultValue: "This transcript has no speaker labels.",
				})}
			</p>
		);
	}

	return (
		<ul className="divide-y">
			{stats.rows.map((row) => {
				const style = speakerStyle(row.index);
				const percent = Math.round((row.talkMs / stats.totalTalk) * 100);
				return (
					<li
						className={`px-4 py-3 ${activeSpeakerId === row.speaker.id ? "bg-muted/60" : ""}`}
						key={row.speaker.id}
					>
						<div className="flex items-center gap-2 text-sm">
							<SpeakerAvatar index={row.index} name={row.speaker.displayName} />
							<span className="min-w-0 flex-1 truncate font-medium">{row.speaker.displayName}</span>
							<span className="text-muted-foreground text-xs tabular-nums">{percent}%</span>
						</div>
						<div className="relative mt-2 h-2 rounded-full bg-muted">
							{row.turns.map((turn) => (
								<button
									aria-label={`${row.speaker.displayName} ${formatClock(turn.startMs)}`}
									className={`absolute top-0 h-2 rounded-full ${style.bar} hover:opacity-80`}
									key={turn.id}
									onClick={() => onSeek(turn.startMs)}
									style={{
										left: `${(turn.startMs / stats.timelineMs) * 100}%`,
										width: `${Math.max(0.6, ((turn.endMs - turn.startMs) / stats.timelineMs) * 100)}%`,
									}}
									type="button"
								/>
							))}
						</div>
					</li>
				);
			})}
		</ul>
	);
};

export const InfoPane = ({
	detail,
}: {
	detail: Pick<WebTranscriptDetail, "title" | "author" | "language" | "segmentCount" | "sourceFilePath" | "record">;
}) => {
	const { t } = useTranslation();
	const durationMs = Math.max(0, ...(detail.record?.segments.map((segment) => segment.endMs) ?? [0]));
	const rows: Array<[string, string | null]> = [
		[t("webTranscripts.info.title", { defaultValue: "Title" }), detail.title],
		[t("webTranscripts.info.author", { defaultValue: "Author" }), detail.author],
		[t("webTranscripts.info.language", { defaultValue: "Language" }), detail.language],
		[t("webTranscripts.info.duration", { defaultValue: "Duration" }), durationMs > 0 ? formatClock(durationMs) : null],
		[t("webTranscripts.info.segments", { defaultValue: "Segments" }), String(detail.segmentCount)],
		[
			t("webTranscripts.info.file", { defaultValue: "File" }),
			detail.sourceFilePath ? (detail.sourceFilePath.split(/[\\/]/).pop() ?? null) : null,
		],
	];
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
			{rows
				.filter(([, value]) => value)
				.map(([label, value]) => (
					<div className="contents" key={label}>
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="min-w-0 break-words">{value}</dd>
					</div>
				))}
		</dl>
	);
};
