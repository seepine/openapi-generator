import { readDocument } from './readDocument'
import { detectVersion } from './detectVersion'
import { normalize } from './normalize'
import type { NormalizedDoc } from '../types'

export async function loadDocument(
  absJsonPath: string,
): Promise<NormalizedDoc> {
  const raw = await readDocument(absJsonPath)
  const version = detectVersion(raw)
  return normalize(raw, version)
}

export { readDocument, detectVersion, normalize }
