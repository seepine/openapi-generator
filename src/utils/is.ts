/**
 * Heuristic: matches `http://` / `https://` URLs (case-insensitive on scheme).
 * Bare paths like `/foo/bar.json` are NOT considered URLs.
 */
export function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input)
}
