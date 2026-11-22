export interface ChaptersData {
	takeaway: string;
	chapters: Array<{ start_seconds: number; title: string; summary: string }>;
	quotes: Array<{ start_seconds: number; quote: string }>;
}

export const parseChapters = (text: string): ChaptersData | null => {
	try {
		const data = JSON.parse(text) as ChaptersData;
		return Array.isArray(data.chapters) ? data : null;
	} catch {
		return null;
	}
};

export const clockLabel = (seconds: number): string => {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

export const ChaptersView = ({
	data,
	onJump,
}: {
	data: ChaptersData;
	onJump: (seconds: number) => void;
}) => (
	<div className="space-y-4 text-sm">
		{data.takeaway && <h2 className="font-semibold text-base">{data.takeaway}</h2>}
		<ul className="space-y-2">
			{data.chapters.map((chapter) => (
				<li key={`${chapter.start_seconds}-${chapter.title}`}>
					<button
						className="flex w-full gap-3 rounded-md p-2 text-left hover:bg-muted"
						onClick={() => onJump(chapter.start_seconds)}
						type="button"
					>
						<span className="w-14 shrink-0 font-medium text-primary tabular-nums">
							{clockLabel(chapter.start_seconds)}
						</span>
						<span>
							<span className="block font-medium">{chapter.title}</span>
							<span className="text-muted-foreground">{chapter.summary}</span>
						</span>
					</button>
				</li>
			))}
		</ul>
		{data.quotes.length > 0 && (
			<div>
				<h3 className="mb-1 font-semibold">Key quotes</h3>
				<ul className="space-y-1">
					{data.quotes.map((quote) => (
						<li key={`${quote.start_seconds}-${quote.quote.slice(0, 20)}`}>
							<button
								className="flex w-full gap-3 rounded-md p-2 text-left hover:bg-muted"
								onClick={() => onJump(quote.start_seconds)}
								type="button"
							>
								<span className="w-14 shrink-0 font-medium text-primary tabular-nums">
									{clockLabel(quote.start_seconds)}
								</span>
								<span>“{quote.quote}”</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		)}
	</div>
);

