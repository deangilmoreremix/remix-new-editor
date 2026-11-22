import { useNavigate } from "@tanstack/react-router";
import {
	AppSidebar,
	type AppSidebarItem,
} from "@vidbee/ui/components/ui/app-sidebar";
import { appSidebarIcons } from "@vidbee/ui/components/ui/app-sidebar-icons";
import BookFill from "~icons/mingcute/book-2-fill";
import BookLine from "~icons/mingcute/book-2-line";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type AppPage =
	| "about"
	| "download"
	| "guide"
	| "settings"
	| "subscriptions"
	| "tools"
	| "transcripts";

interface AppShellProps {
	children: ReactNode;
	page: AppPage;
}

export const AppShell = ({ children, page }: AppShellProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const items: AppSidebarItem[] = [
		{
			id: "home",
			active: page === "download",
			icon: appSidebarIcons.home,
			label: t("menu.home"),
			onClick: () => {
				void navigate({ to: "/" });
			},
		},
		{
			id: "transcripts",
			active: page === "transcripts",
			icon: appSidebarIcons.transcripts,
			label: t("menu.transcripts"),
			onClick: () => {
				void navigate({ to: "/transcripts" });
			},
		},
		{
			id: "subscriptions",
			active: page === "subscriptions",
			icon: appSidebarIcons.subscriptions,
			label: t("menu.rss"),
			onClick: () => {
				void navigate({ to: "/subscriptions" });
			},
		},
		{
			id: "tools",
			icon: appSidebarIcons.tools,
			label: t("menu.tools"),
			active: page === "tools",
			onClick: () => {
				void navigate({ to: "/tools" });
			},
		},
	];

	const bottomItems: AppSidebarItem[] = [
		{
			id: "settings",
			active: page === "settings",
			icon: appSidebarIcons.settings,
			label: t("menu.preferences"),
			showLabel: false,
			showTooltip: true,
			onClick: () => {
				void navigate({ to: "/settings" });
			},
		},
		{
			id: "guide",
			active: page === "guide",
			icon: { active: BookFill, inactive: BookLine },
			label: t("webTranscripts.guide.menu", { defaultValue: "Guide" }),
			onClick: () => {
				void navigate({ to: "/guide" });
			},
			showLabel: false,
			showTooltip: true,
		},
		{
			id: "about",
			active: page === "about",
			icon: appSidebarIcons.about,
			label: t("menu.about"),
			onClick: () => {
				void navigate({ to: "/about" });
			},
			showLabel: false,
			showTooltip: true,
		},
	];

	return (
		<div className="flex h-screen flex-row">
			<AppSidebar
				appName="VidBee"
				bottomItems={bottomItems}
				items={items}
				logoAlt="VidBee"
				logoSrc="/app-icon.png"
			/>

			<main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
				<div className="h-full flex-1 overflow-y-auto overflow-x-hidden">
					{children}
				</div>
			</main>
		</div>
	);
};
