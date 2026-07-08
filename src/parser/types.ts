import type { JsonSchema } from '../types'

export type TsType =
  | {
      kind: 'primitive'
      value:
        'string' | 'number' | 'boolean' | 'null' | 'unknown' | 'never' | 'Blob'
    }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'union'; types: TsType[] }
  | { kind: 'array'; item: TsType }
  | { kind: 'object'; properties: TsProperty[] }
  | { kind: 'literalUnion'; literals: (string | number)[] }

export interface TsProperty {
  name: string
  type: TsType
  optional: boolean
  description?: string
}

export interface ParserContext {
  schemas: Record<string, JsonSchema>
  /** Refs currently being resolved — used to break cycles. */
  refStack: Set<string>
  /** Max recursion depth (default 30). */
  depth: number
}
