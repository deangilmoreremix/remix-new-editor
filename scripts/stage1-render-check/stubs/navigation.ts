// Harness stand-in for the app router glue (@ohb/lib/navigation): navigation is irrelevant to editor behaviour.
const noop = () => {}
export function useRouter() { return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop } }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }
export const navigate = noop
export default { useRouter }
