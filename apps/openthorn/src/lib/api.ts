/**
 * URL of a builder server endpoint. The builder is served under a sub-path in
 * SmartVideo (`/openthorn/`), so endpoints are `${BASE_URL}api/<name>`; in `vite dev`
 * BASE_URL is `/` and the dev middleware answers `/api/<name>`.
 */
export function apiUrl(name: string): string {
  return `${import.meta.env.BASE_URL}api/${name}`
}
