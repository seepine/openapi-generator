import type { TsType } from './types'

/** Default: compact single-line. */
export function printType(t: TsType): string {
  switch (t.kind) {
    case 'primitive':
      return t.value
    case 'literal':
      if (typeof t.value === 'string')
        return `'${t.value.replace(/'/g, "\\'")}'`
      if (t.value === null) return 'null'
      return String(t.value)
    case 'literalUnion':
      return t.literals
        .map((l) =>
          typeof l === 'string' ? `'${l.replace(/'/g, "\\'")}'` : String(l),
        )
        .join(' | ')
    case 'ref':
      return t.name
    case 'array':
      return `Array<${printType(t.item)}>`
    case 'union':
      return t.types.map(printType).join(' | ')
    case 'object':
      return printObjectInline(t)
  }
}

export function printObjectInline(t: TsType): string {
  if (t.kind !== 'object') return printType(t)
  const parts = t.properties.map((p) => {
    const opt = p.optional ? '?' : ''
    const fieldType = printType(p.type)
    return `${p.name}${opt}: ${fieldType}`
  })
  if (parts.length === 0) return '{}'
  return `{ ${parts.join('; ')}; }`
}

/** Property kinds whose `printType` output fits on a single line. */
type SimpleKind = 'primitive' | 'literal' | 'ref' | 'literalUnion'

function isSimpleKind(kind: TsType['kind']): boolean {
  return (
    kind === 'primitive' ||
    kind === 'literal' ||
    kind === 'ref' ||
    kind === 'literalUnion'
  )
}

function isAllSimpleObject(t: Extract<TsType, { kind: 'object' }>): boolean {
  return t.properties.every((p) => {
    if (isSimpleKind(p.type.kind)) return true
    if (p.type.kind !== 'array') return false
    return isSimpleKind(p.type.item.kind)
  })
}

export interface PrintObjectMultilineOptions {
  /**
   * When true (default), an all-simple object collapses to inline form.
   * Set to false to force multi-line output (used by data/params fields).
   */
  collapseSimple?: boolean
}

export function printObjectMultiline(
  t: TsType,
  indentStr: string,
  options: PrintObjectMultilineOptions = {},
): string {
  if (t.kind !== 'object') return printType(t)
  if (t.properties.length === 0) return '{}'
  const collapseSimple = options.collapseSimple ?? true
  if (collapseSimple && isAllSimpleObject(t)) return printObjectInline(t)

  // Multi-line: each field on its own line, joined by `;`.
  const inner = indentStr + '  '
  const parts = t.properties.map((p) => {
    const opt = p.optional ? '?' : ''
    const fieldType =
      p.type.kind === 'union' ||
      p.type.kind === 'object' ||
      p.type.kind === 'array'
        ? printPropertyTypeMultiline(p.type, inner)
        : printType(p.type)
    return `${inner}${p.name}${opt}: ${fieldType}`
  })
  return `{\n${parts.join(';\n')};\n${indentStr}}`
}

function printPropertyTypeMultiline(t: TsType, indentStr: string): string {
  if (t.kind === 'union') {
    // Each branch on its own indented line, joined by ` | ` at start of next line.
    const branches = t.types.map((b) =>
      printPropertyTypeMultiline(b, indentStr),
    )
    if (branches.length > 1) {
      return branches.join(`\n${indentStr}| `)
    }
    return branches[0]!
  }
  if (t.kind === 'object') {
    return printObjectMultiline(t, indentStr)
  }
  return printType(t)
}
