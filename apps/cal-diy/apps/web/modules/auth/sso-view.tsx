"use client";

import { safeNextPath } from "@calcom/features/auth/lib/ssoNextPath";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// The host app opens `/auth/sso#token=<session token>&next=/availability`. The token sits in the URL fragment so it is
// never sent to a server or written to a log, and it is removed from the address bar before anything else happens.
export default function SsoView() {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // React runs effects twice in development; two sign-ins at once invalidate each other's CSRF token.
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token") ?? "";
    const next = safeNextPath(params.get("next"));
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setFailed(true);
      return;
    }
    const run = async () => {
      // Cal.diy's own page code also asks NextAuth for a CSRF token while the page loads. When the two requests overlap,
      // one overwrites the other's cookie and NextAuth answers "ok" with a soft failure, so a soft failure is retried.
      // A real refusal (bad or expired token) carries an error and is not retried.
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await signIn("sso-bridge", { token, redirect: false });
        if (res?.error) break;
        const session = res?.ok ? await getSession() : null;
        if (session?.user) {
          window.location.replace(next);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setFailed(true);
    };
    run().catch(() => setFailed(true));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      {failed ? (
        <div>
          <h1 className="text-xl font-semibold">We couldn't sign you in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Go back to the app and open Scheduling again. If it keeps happening, sign out and back in to the app.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Signing you in…</p>
      )}
    </div>
  );
}
