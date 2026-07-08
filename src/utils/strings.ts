/**
 * OpenAPI tag → legal TypeScript identifier.
 * - `admin-config` → `adminConfig`
 * - `AdminConfig` → `adminConfig`
 * - `snake_case_tag` → `snakeCaseTag`
 * - `''` → `_` (fallback; leading `_` is also prepended if the result starts with a digit)
 */
export function toIdentifier(input: string): string {
  const segments = input.split(/[-_\s]+/).filter((seg) => seg.length > 0)
  if (segments.length === 0) return '_'
  const tokens = segments.flatMap((seg) =>
    seg
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0),
  )
  if (tokens.length === 0) return '_'
  const camel = tokens
    .map((t, i) => (i === 0 ? t : t.charAt(0).toUpperCase() + t.slice(1)))
    .join('')
  return /^\d/.test(camel) ? `_${camel}` : camel
}

/**
 * Tag key shared by the apiDefinitions runtime map and the generated
 * `interface Apis`. An empty/blank tag lands in the literal `default`
 * namespace so the generated code is both valid TS and discoverable
 * (e.g. `Apis.default.getA`).
 */
export function tagKey(tag: string): string {
  return tag ? toIdentifier(tag) : 'default'
}
