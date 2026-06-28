/**
 * Convert an OpenAPI tag (or any string) into a legal TypeScript identifier.
 *
 * - `admin-config` → `adminConfig`
 * - `users` → `users`
 * - `users-v2` → `usersV2`
 * - `AdminConfig` → `adminConfig` (PascalCase also lowercased)
 * - `adminConfig` → `adminConfig` (idempotent)
 * - `snake_case_tag` → `snakeCaseTag`
 * - `''` or invalid → `_` (fallback)
 *
 * Strategy: split on `-` / `_` / whitespace, then split each segment at
 * camelCase boundaries (lowercase|digit → uppercase), lowercase every
 * token, and reassemble as camelCase. If the result would start with a
 * digit, a leading `_` is prepended.
 */
export function toIdentifier(input: string): string {
  const segments = input.split(/[-_\s]+/).filter((seg) => seg.length > 0)
  if (segments.length === 0) return '_'
  const tokens = segments
    .map((seg) =>
      seg
        // Insert a separator at every camelCase boundary, then lowercase.
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    )
    .flat()
  if (tokens.length === 0) return '_'
  const camel = tokens
    .map((t, i) => (i === 0 ? t : (t[0] ?? '').toUpperCase() + t.slice(1)))
    .join('')
  return /^\d/.test(camel) ? `_${camel}` : camel
}
