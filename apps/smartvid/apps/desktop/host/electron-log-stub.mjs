// Host shim (not upstream): console-backed stand-in for `electron-log/main` (its preload injection can't be bundled for Node).
const LEVELS = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
const quiet = process.env.SMARTVID_LOG_LEVEL === 'quiet';
/** Permissive chain: any property/call returns another no-op, so config code like transports.file.getFile().path keeps working. */
const deep = () => new Proxy(function () {}, {
  get: (_t, p) => (p === 'path' ? '/dev/null' : p === 'then' ? undefined : p === Symbol.toPrimitive ? () => '' : deep()),
  apply: () => deep(),
  set: () => true,
});
const make = (scope) => {
  const target = {};
  for (const level of LEVELS) {
    target[level] = (...args) => {
      if (quiet && level !== 'error') return;
      if (level === 'verbose' || level === 'silly' || level === 'debug') return;
      (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(`[${scope ?? 'smartvid'}]`, ...args);
    };
  }
  target.log = target.info;
  target.scope = (name) => make(name);
  target.initialize = () => {};
  target.transports = deep();
  target.errorHandler = { startCatching() {}, handle() {} };
  target.eventLogger = { startLogging() {}, stopLogging() {} };
  target.hooks = [];
  target.functions = {};
  target.variables = {};
  target.catchErrors = () => {};
  return new Proxy(target, { get: (t, p) => (p in t ? t[p] : () => undefined) });
};
const log = make();
export default log;
export const { error, warn, info, verbose, debug, silly, scope, initialize, transports } = log;
