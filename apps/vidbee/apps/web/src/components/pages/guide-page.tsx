import { AppShell } from "../layout/app-shell";
import guide from "../../content/user-guide.md?raw";
import { MarkdownView } from "./markdown-view";

/** The in-app user guide. The text lives in src/content/user-guide.md. */
export const GuidePage = () => (
	<AppShell page="guide">
		<div
			className="mx-auto max-w-3xl p-6 [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:border-t [&_h3]:pt-4 [&_h3]:text-lg [&_li]:leading-relaxed [&_p]:leading-relaxed"
			data-testid="user-guide"
		>
			<MarkdownView text={guide} />
		</div>
	</AppShell>
);
