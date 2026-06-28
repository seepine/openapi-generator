import type { NormalizedOperation } from '../types'
import { warn } from '../utils/logger'
import { renderHeaderComment } from '../writer/header'
import { toIdentifier } from '../utils/strings'

export interface ApiDefinition {
  key: string
  method:
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE'
  path: string
}

/**
 * Build the apiDefinitions.ts file content from a list of operations.
 * Skips operations without operationId (warns). On duplicate keys the latest
 * entry wins (warns).
 */
export function generateApiDefinitions(
  operations: NormalizedOperation[],
  meta: { title: string; version: string; openapiVersion: string },
): string {
  // Map preserves insertion order; last write wins on duplicate keys.
  const entries = new Map<string, [string, string]>()

  for (const op of operations) {
    if (!op.operationId) {
      warn(
        `skip operation without operationId at ${op.method.toUpperCase()} ${op.path}`,
      )
      continue
    }
    const key = `${op.tag ? toIdentifier(op.tag) : ''}.${op.operationId}`
    if (entries.has(key)) {
      warn(`duplicate api definition key: ${key} (overwriting)`)
    }
    entries.set(key, [op.method.toUpperCase(), op.path])
  }

  // Wormhole-style body: single-quoted keys, space-separated values, no
  // trailing comma inside the object literal.
  const body =
    entries.size === 0
      ? ''
      : '\n' +
        Array.from(
          entries,
          ([k, v]) => `  '${k}': ['${v[0]}', '${v[1]}']`,
        ).join(',\n') +
        '\n'

  const header = renderHeaderComment(meta)

  return [
    "/// <reference types='./globals.d.ts' />",
    header,
    `export default {${body}};`,
    '',
  ].join('\n')
}
