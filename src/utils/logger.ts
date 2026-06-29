/** Sink for runtime warnings and errors emitted by the generator. */
export interface Logger {
  warn?: (msg: string) => void
  error?: (msg: string) => void
}

let _warn = (msg: string): void => {
  console.warn(`[openapi-generator] ${msg}`)
}
let _error = (msg: string): void => {
  console.error(`[openapi-generator] ${msg}`)
}

/** Override the default logger. Missing fields keep their previous defaults. */
export function setLogger(logger: Logger): void {
  if (logger.warn) _warn = logger.warn
  if (logger.error) _error = logger.error
}

export function warn(msg: string): void {
  _warn(msg)
}
export function error(msg: string): void {
  _error(msg)
}
