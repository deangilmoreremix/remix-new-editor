import { Button } from "@smartvid/ui/components/ui/button";
import { Input } from "@smartvid/ui/components/ui/input";
import type { WebAiRun, WebAiSkill } from "@smartvid/transcription/web-contract";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { aiClient } from "../../lib/orpc-client";
import { useLiveStream } from "../../lib/use-live-stream";
import { MarkdownView } from "./markdown-view";

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

const ICONS = ["✨", "📝", "🧠", "📊", "🔎", "🎯", "💡", "📚", "🗂️", "🧾"];

interface Draft {
	id?: string;
	title: string;
	icon: string;
	content: string;
}

/** The prompt catalog: show or hide tabs, edit, add, restore defaults, and test on a sample. */
export const PromptManager = ({
	skills,
	languageName,
	onChange,
}: {
	skills: WebAiSkill[];
	languageName: string;
	onChange: (next: WebAiSkill[]) => void;
}) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<Draft | null>(null);
	const [test, setTest] = useState<WebAiRun | null>(null);
	const [saving, setSaving] = useState(false);
	const editable = draft ? skills.find((skill) => skill.id === draft.id)?.editable !== false : true;

	const testing = test?.status === "running";
	useLiveStream(
		testing,
		{ channel: "ai", downloadId: "__sample__", skillId: "__test__" },
		{
			onState: (state) => state && typeof state === "object" && setTest(state as WebAiRun),
			onDelta: (delta) => setTest((previous) => (previous ? { ...previous, text: previous.text + delta } : previous)),
		},
	);

	const wrap = async (work: () => Promise<WebAiSkill[]>, success?: string): Promise<boolean> => {
		setSaving(true);
		try {
			onChange(await work());
			if (success) {
				toast.success(success);
			}
			return true;
		} catch (error) {
			toast.error(messageOf(error));
			return false;
		} finally {
			setSaving(false);
		}
	};

	const save = async () => {
		if (!draft) {
			return;
		}
		const ok = await wrap(
			() => aiClient.promptsSave({ id: draft.id, title: draft.title, icon: draft.icon, content: draft.content }),
			t("webTranscripts.prompts.saved", { defaultValue: "Prompt saved" }),
		);
		if (ok) {
			setDraft(null);
			setTest(null);
		}
	};

	const runTest = async () => {
		if (!draft) {
			return;
		}
		try {
			setTest(await aiClient.promptsTest({ content: draft.content, language: languageName }));
		} catch (error) {
			toast.error(messageOf(error));
		}
	};

	if (draft) {
		return (
			<div className="max-w-2xl space-y-3 rounded-md border p-4 text-sm" data-testid="prompt-editor">
				<div className="font-medium">
					{draft.id
						? t("webTranscripts.prompts.edit", { defaultValue: "Edit prompt" })
						: t("webTranscripts.prompts.add", { defaultValue: "Add prompt" })}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<select
						aria-label="Icon"
						className="rounded border bg-background px-2 py-1"
						disabled={!editable}
						onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
						value={draft.icon}
					>
						{[...new Set([draft.icon, ...ICONS])].map((icon) => (
							<option key={icon} value={icon}>
								{icon}
							</option>
						))}
					</select>
					<Input
						aria-label="Title"
						className="max-w-xs"
						disabled={!editable}
						onChange={(event) => setDraft({ ...draft, title: event.target.value })}
						placeholder={t("webTranscripts.prompts.title", { defaultValue: "Title" })}
						value={draft.title}
					/>
				</div>
				<textarea
					aria-label="Instructions"
					className="min-h-40 w-full rounded-md border bg-background p-2 font-mono text-xs"
					disabled={!editable}
					onChange={(event) => setDraft({ ...draft, content: event.target.value })}
					value={draft.content}
				/>
				<p className="text-muted-foreground text-xs">
					{t("webTranscripts.prompts.variable", {
						defaultValue: "Use {{uiLanguage}} to insert the interface language name (for example English or 中文) before the request is sent.",
					})}
				</p>
				<div className="flex flex-wrap gap-2">
					<Button disabled={saving || !editable} onClick={() => void save()} size="sm">
						{t("webTranscripts.ai.save", { defaultValue: "Save" })}
					</Button>
					<Button disabled={testing || !draft.content.trim()} onClick={() => void runTest()} size="sm" variant="outline">
						{t("webTranscripts.prompts.run", { defaultValue: "Run on a sample" })}
					</Button>
					<Button
						onClick={() => {
							setDraft(null);
							setTest(null);
						}}
						size="sm"
						variant="ghost"
					>
						{t("webTranscripts.prompts.close", { defaultValue: "Close" })}
					</Button>
				</div>
				{test && (
					<div className="space-y-2 border-t pt-3" data-testid="prompt-test">
						<div className="text-muted-foreground text-xs">
							{t("webTranscripts.prompts.sample", { defaultValue: "Result on a built-in sample interview (nothing is saved):" })}
						</div>
						{test.error && <p className="text-destructive">{test.error}</p>}
						{test.text && <MarkdownView streaming={testing} text={test.text} />}
						{testing && !test.text && <p className="text-muted-foreground text-xs">…</p>}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="max-w-2xl space-y-3 rounded-md border p-4 text-sm" data-testid="prompt-manager">
			<div className="flex flex-wrap items-center gap-2">
				<div className="mr-auto font-medium">{t("webTranscripts.prompts.title2", { defaultValue: "Prompts" })}</div>
				<Button onClick={() => setDraft({ title: "", icon: "✨", content: "" })} size="sm">
					{t("webTranscripts.prompts.add", { defaultValue: "Add prompt" })}
				</Button>
				<Button
					disabled={saving}
					onClick={() => void wrap(() => aiClient.promptsRestore(), t("webTranscripts.prompts.restored", { defaultValue: "Defaults restored" }))}
					size="sm"
					variant="outline"
				>
					{t("webTranscripts.prompts.restore", { defaultValue: "Restore defaults" })}
				</Button>
			</div>
			<ul className="divide-y">
				{skills.map((skill) => (
					<li className="flex items-center gap-2 py-2" key={skill.id}>
						<span>{skill.icon}</span>
						<span className="mr-auto">
							{skill.title}
							{skill.edited && <span className="ml-2 text-muted-foreground text-xs">(edited)</span>}
							{!skill.builtin && <span className="ml-2 text-muted-foreground text-xs">(custom)</span>}
						</span>
						<label className="flex items-center gap-1 text-xs" title="Show as a tab next to the transcript">
							<input
								checked={skill.visible}
								onChange={(event) => {
									const visible = event.target.checked;
									const before = skills;
									// Show the change at once; undo it if the server refuses.
									onChange(skills.map((item) => (item.id === skill.id ? { ...item, visible } : item)));
									void wrap(() => aiClient.promptsVisible({ id: skill.id, visible })).then((ok) => {
										if (!ok) {
											onChange(before);
										}
									});
								}}
								type="checkbox"
							/>
							{t("webTranscripts.prompts.tab", { defaultValue: "Tab" })}
						</label>
						<Button
							disabled={!skill.editable}
							onClick={() => setDraft({ id: skill.id, title: skill.title, icon: skill.icon, content: skill.content })}
							size="sm"
							title={skill.editable ? undefined : "This prompt's output format is fixed"}
							variant="outline"
						>
							{t("webTranscripts.prompts.editButton", { defaultValue: "Edit" })}
						</Button>
						{(!skill.builtin || skill.edited) && (
							<Button
								onClick={() => void wrap(() => aiClient.promptsDelete({ id: skill.id }))}
								size="sm"
								variant="ghost"
							>
								{skill.builtin
									? t("webTranscripts.prompts.reset", { defaultValue: "Reset" })
									: t("webTranscripts.prompts.delete", { defaultValue: "Delete" })}
							</Button>
						)}
					</li>
				))}
			</ul>
		</div>
	);
};
