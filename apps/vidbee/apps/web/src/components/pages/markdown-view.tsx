import { type ReactNode, useEffect, useId, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

/** Load Mermaid once, only when a diagram is shown. Strict mode sanitises the SVG it returns. */
const loadMermaid = () => {
	mermaidReady ??= import("mermaid").then((module) => {
		module.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
		return module.default;
	});
	return mermaidReady;
};

const MermaidDiagram = ({ code }: { code: string }) => {
	const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setSvg(null);
		setFailed(false);
		void loadMermaid()
			.then((mermaid) => mermaid.render(id, code))
			.then((result) => !cancelled && setSvg(result.svg))
			.catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
			document.getElementById(`d${id}`)?.remove();
		};
	}, [code, id]);

	if (failed) {
		return (
			<div className="space-y-1">
				<p className="text-muted-foreground text-xs">
					This diagram could not be drawn. Showing its source:
				</p>
				<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{code}</pre>
			</div>
		);
	}
	return svg ? (
		<div
			className="overflow-x-auto"
			// Mermaid in strict mode returns sanitised SVG.
			// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by Mermaid (securityLevel strict)
			dangerouslySetInnerHTML={{ __html: svg }}
			data-testid="mermaid-diagram"
		/>
	) : (
		<p className="text-muted-foreground text-xs">Drawing the diagram…</p>
	);
};

const safeHref = (href: string | undefined): string | undefined =>
	href && /^(https?:|mailto:)/i.test(href) ? href : undefined;

const buildComponents = (streaming: boolean): Components => ({
	h1: ({ children }) => <h2 className="mt-1 font-semibold text-base">{children}</h2>,
	h2: ({ children }) => <h3 className="mt-3 font-semibold">{children}</h3>,
	h3: ({ children }) => <h4 className="mt-2 font-medium">{children}</h4>,
	p: ({ children }) => <p className="leading-relaxed">{children}</p>,
	ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
	ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
	a: ({ href, children }) => {
		const safe = safeHref(href);
		return safe ? (
			<a className="text-primary underline" href={safe} rel="noopener noreferrer" target="_blank">
				{children}
			</a>
		) : (
			<span>{children}</span>
		);
	},
	blockquote: ({ children }) => (
		<blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
	),
	table: ({ children }) => (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse text-left">{children}</table>
		</div>
	),
	th: ({ children }) => <th className="border-b px-2 py-1 font-medium">{children}</th>,
	td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
	pre: ({ children }) => <>{children}</>,
	code: ({ className, children }) => {
		const text = String(children ?? "").replace(/\n$/, "");
		const language = /language-(\w+)/.exec(className ?? "")?.[1];
		if (language === "mermaid") {
			// A half-written diagram would fail to parse, so draw it once the text is complete.
			return streaming ? (
				<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{text}</pre>
			) : (
				<MermaidDiagram code={text} />
			);
		}
		const isBlock = Boolean(language) || text.includes("\n");
		return isBlock ? (
			<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{text}</pre>
		) : (
			<code className="rounded bg-muted px-1 py-0.5 text-xs">{text}</code>
		);
	},
});

/** Markdown from the model: headings, lists, tables, code, and Mermaid diagrams. No raw HTML. */
export const MarkdownView = ({
	text,
	streaming = false,
}: {
	text: string;
	streaming?: boolean;
}): ReactNode => (
	<div className="space-y-2 text-sm" data-testid="markdown-view">
		<ReactMarkdown components={buildComponents(streaming)} remarkPlugins={[remarkGfm]}>
			{text}
		</ReactMarkdown>
	</div>
);
