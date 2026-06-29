/** Matches `http://` / `https://` URLs (case-insensitive on scheme). */
export function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input)
}
