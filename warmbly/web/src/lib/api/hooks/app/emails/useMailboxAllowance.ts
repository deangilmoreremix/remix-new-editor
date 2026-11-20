import { useQuery } from "@tanstack/react-query";
import getMailboxAllowance from "@/lib/api/client/app/emails/getMailboxAllowance";

/** Under the ["emails"] prefix so every mailbox event refreshes it live. */
export const MAILBOX_ALLOWANCE_KEY = ["emails", "allowance"] as const;

// This app shows no mailbox allowance, so it is never looked up.
export default function useMailboxAllowance(_enabled = true) {
    return useQuery({
        queryKey: MAILBOX_ALLOWANCE_KEY,
        queryFn: getMailboxAllowance,
        enabled: false,
        staleTime: 15_000,
    });
}
