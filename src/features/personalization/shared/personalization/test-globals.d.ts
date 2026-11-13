// React's `act()` looks for this flag on globalThis in tests; declaring it lets tests set it without a cast.
// `declare var` (not let/const) is what adds a property to globalThis in a global declaration file.
// eslint-disable-next-line no-var
declare var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
