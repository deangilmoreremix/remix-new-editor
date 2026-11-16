import type Token from "../../models/auth/Token";
import { syncHostToken } from "../../../hostSession";

// There is no Warmbly refresh endpoint: the host app's Clerk session is the source of truth, so a
// "refresh" is asking Clerk for a fresh token. The argument is the placeholder the Token carries.
export default async function refreshToken(_refresh_token: string): Promise<Token> {
    const token = await syncHostToken();
    if (!token) throw { status: 401, redirect: true, message: "Signed out of the host app" };
    return token;
}
