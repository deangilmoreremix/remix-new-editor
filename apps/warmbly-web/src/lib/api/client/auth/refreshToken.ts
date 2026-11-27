import type Token from "../../models/auth/Token";
import type RefreshToken from "../../models/auth/RefreshToken";
import Request from "../Request";
import { HOST_SESSION } from "@/lib/information";
import { syncHostToken } from "@/lib/hostSession";
import { useAppStore } from "@/stores/useAppStore";
import switchOrganization from "../app/organizations/switchOrganization";

export default async function refreshToken(refresh_token: string): Promise<Token> {
    if (HOST_SESSION) {
        // The host app's Clerk session refreshes itself; there is no Warmbly refresh token.
        const token = await syncHostToken();
        if (!token) throw new Error("host session ended");
        // A new session starts on the default workspace; put the one the person had selected back, so
        // what the screen shows and where requests go stay the same.
        const selected = useAppStore.getState().currentOrganization;
        if (selected) await switchOrganization(selected.id).catch(() => {});
        return token;
    }
    const data: RefreshToken = {
        refresh_token,
    }

    const res = await Request<Token>({
        method: "POST",
        url: "/auth/refresh",
        data,
    })

    return res
}
