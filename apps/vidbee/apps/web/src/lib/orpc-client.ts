import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { downloaderContract } from "@vidbee/downloader-core";
import type { subscriptionContract } from "@vidbee/subscriptions-core/contract";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiUrl = configuredApiUrl
	? configuredApiUrl.replace(/\/+$/, "")
	: "";
const defaultOrigin =
	typeof window === "undefined"
		? process.env.VIDBEE_API_URL_INTERNAL?.trim() || "http://api:3100"
		: window.location.origin;
// [host patch] API/SSE/file/image calls go through the host app's sub-path.
const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
export const apiUrl = normalizedApiUrl || `${defaultOrigin}${basePath}`;

export const eventsUrl = `${apiUrl}/events`;

export const fileDownloadUrl = (filePath: string): string =>
	`${apiUrl}/files?path=${encodeURIComponent(filePath)}`;
const rpcUrl = `${apiUrl}/rpc`;

export const orpcClient: ContractRouterClient<typeof downloaderContract> =
	createORPCClient(
		new RPCLink({
			url: rpcUrl,
		}),
	);

export const subscriptionsClient: ContractRouterClient<
	typeof subscriptionContract
> = createORPCClient(
	new RPCLink({
		url: `${rpcUrl}/subscriptions`,
	}),
);
