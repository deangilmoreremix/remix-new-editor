import { Button } from "@vidbee/ui/components/ui/button";
import { Input } from "@vidbee/ui/components/ui/input";
import type { WebAiConnectionTest, WebAiSettings } from "@vidbee/transcription/web-contract";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { clearOpenAiKey, saveOpenAiKey } from "../../lib/byok-key";
import { aiClient } from "../../lib/orpc-client";

const messageOf = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "Request failed";

/** API key, model ID and base URL, with a connection test that works before saving. */
export const AiSettingsForm = ({
	settings,
	onSaved,
}: {
	settings: WebAiSettings;
	onSaved: (next: WebAiSettings) => void;
}) => {
	const { t } = useTranslation();
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState(settings.model);
	const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [test, setTest] = useState<WebAiConnectionTest | null>(null);

	const save = async (clearApiKey = false) => {
		setSaving(true);
		try {
			if (settings.byok) {
				// Bring your own key: the key stays in this browser and goes out with each AI request.
				if (clearApiKey) {
					clearOpenAiKey();
				} else {
					saveOpenAiKey({
						apiKey: apiKey.trim() || undefined,
						model: model.trim() || undefined,
					});
				}
				setApiKey("");
				const next = await aiClient.settingsGet();
				onSaved(next);
				toast.success(t("webTranscripts.ai.saved", { defaultValue: "AI settings saved" }));
				return;
			}
			const next = await aiClient.settingsSet({
				apiKey: apiKey.trim() || undefined,
				clearApiKey,
				baseUrl,
				model,
			});
			setApiKey("");
			onSaved(next);
			toast.success(t("webTranscripts.ai.saved", { defaultValue: "AI settings saved" }));
		} catch (error) {
			toast.error(messageOf(error));
		} finally {
			setSaving(false);
		}
	};

	const runTest = async () => {
		setTesting(true);
		setTest(null);
		try {
			setTest(
				await aiClient.testConnection({
					apiKey: apiKey.trim() || undefined,
					baseUrl,
					model,
				}),
			);
		} catch (error) {
			setTest({ ok: false, model, reply: null, error: messageOf(error) });
		} finally {
			setTesting(false);
		}
	};

	return (
		<div className="max-w-md space-y-3 rounded-md border p-4 text-sm" data-testid="ai-settings">
			<div className="font-medium">
				{t("webTranscripts.ai.settings", { defaultValue: "OpenAI settings" })}
			</div>
			<label className="block space-y-1">
				<span className="text-muted-foreground">API key</span>
				<Input
					autoComplete="off"
					onChange={(event) => setApiKey(event.target.value)}
					placeholder={
						settings.hasApiKey
							? `••••${settings.apiKeyHint ?? ""}${settings.keyFromEnv ? " (from server environment)" : ""}`
							: "sk-…"
					}
					type="password"
					value={apiKey}
				/>
			</label>
			<label className="block space-y-1">
				<span className="text-muted-foreground">Model ID</span>
				<Input onChange={(event) => setModel(event.target.value)} value={model} />
			</label>
			{!settings.byok && (
			<label className="block space-y-1">
				<span className="text-muted-foreground">Base URL</span>
				<Input onChange={(event) => setBaseUrl(event.target.value)} value={baseUrl} />
				<span className="text-muted-foreground text-xs">
					{t("webTranscripts.ai.baseUrlHint", {
						defaultValue: "Changing the base URL needs the API key typed again, so a saved key is never sent to a new address.",
					})}
				</span>
			</label>
			)}
			<div className="flex flex-wrap gap-2">
				<Button disabled={testing} onClick={() => void runTest()} size="sm" variant="outline">
					{testing
						? t("webTranscripts.ai.testing", { defaultValue: "Testing…" })
						: t("webTranscripts.ai.test", { defaultValue: "Test connection" })}
				</Button>
				<Button disabled={saving} onClick={() => void save()} size="sm">
					{t("webTranscripts.ai.save", { defaultValue: "Save" })}
				</Button>
				{settings.hasApiKey && !settings.keyFromEnv && (
					<Button disabled={saving} onClick={() => void save(true)} size="sm" variant="outline">
						{t("webTranscripts.ai.removeKey", { defaultValue: "Remove key" })}
					</Button>
				)}
			</div>
			{test && (
				<p className={test.ok ? "text-emerald-600" : "text-destructive"} data-testid="ai-test-result">
					{test.ok
						? `${t("webTranscripts.ai.testOk", { defaultValue: "Connected. Reply:" })} “${test.reply}”`
						: test.error}
				</p>
			)}
			<p className="text-muted-foreground text-xs">
				{settings.byok
					? t("webTranscripts.ai.privacyByok", {
							defaultValue:
								"Your OpenAI key is saved only in this browser and sent with each AI request over HTTPS. It is never stored on the server. Only the transcript text goes to OpenAI when you run a prompt; media files stay on the server. Use a key with a spending limit, and clear it on shared computers.",
						})
					: t("webTranscripts.ai.privacy", {
					defaultValue:
						"The key is stored on the server and never sent back to the browser. Only the transcript text is sent to this endpoint when you run a prompt; media files stay on the server.",
				})}
			</p>
		</div>
	);
};
