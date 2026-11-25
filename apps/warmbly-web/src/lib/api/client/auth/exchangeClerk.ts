import type { LoginResult } from "../../models/auth/LoginResult";
import Request from "../Request";

/**
 * Swaps the host app's Clerk session token for a session here, so the person
 * signs in once, to the host app. The backend verifies the Clerk token, finds or
 * creates the account on first visit, and answers like any other login.
 */
export default async function exchangeClerk(token: string): Promise<LoginResult> {
    return await Request<LoginResult>({
        method: "POST",
        url: "/auth/clerk",
        data: { token },
    });
}
