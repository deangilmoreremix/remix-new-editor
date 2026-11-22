/** Desktop notifications for long jobs, shown only when the tab is in the background. */

export const notificationsSupported = (): boolean =>
	typeof window !== "undefined" && "Notification" in window;

export const notificationPermission = (): NotificationPermission | "unsupported" =>
	notificationsSupported() ? Notification.permission : "unsupported";

/** Must be called from a click: browsers ignore permission prompts without a user gesture. */
export const requestNotifications = async (): Promise<NotificationPermission | "unsupported"> => {
	if (!notificationsSupported()) {
		return "unsupported";
	}
	return await Notification.requestPermission();
};

export const notify = (title: string, body?: string): void => {
	if (!notificationsSupported() || Notification.permission !== "granted") {
		return;
	}
	if (!document.hidden) {
		return;
	}
	try {
		new Notification(title, { body, tag: `smartvid:${title}` });
	} catch {
		// Some browsers only allow notifications from a service worker.
	}
};
