# Stage 9 full-stack email check

Real route handler → real `nodemailer` → a real SMTP server on 127.0.0.1 (`smtp-server`) → message parsed by `mailparser`;
the unsubscribe link found in the received email is followed through the real `outreach-unsubscribe.js` against real SQL
(throwaway local Postgres, real migration). No mail leaves the machine.

```bash
npx vitest run --config scripts/stage9-email-check/vitest.stage9.config.mjs
```

Needs `su postgres` access to a local Postgres. SMTP acceptance here is not inbox delivery.
