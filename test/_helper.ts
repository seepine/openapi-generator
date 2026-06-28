import { readFile, rm, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { generate } from '../src/generate'

export const ALL_FILES = [
  'apiDefinitions.ts',
  'globals.d.ts',
  'createApis.ts',
  'index.ts',
] as const

export interface FixtureOutput {
  dir: string
  apiDefinitions: string
  globals: string
  createApis: string
  index: string
}

/**
 * Recreate <fixtureDir>/output (clean if exists).
 */
export async function setupOutput(fixtureDir: string): Promise<string> {
  const out = join(fixtureDir, 'output')
  if (existsSync(out)) {
    await rm(out, { recursive: true, force: true })
  }
  await mkdir(out, { recursive: true })
  return out
}

/**
 * Read all expected generated files. Throws if any is missing or empty.
 */
export async function expectAllFiles(dir: string): Promise<FixtureOutput> {
  const result: Record<string, string> = {}
  for (const name of ALL_FILES) {
    const path = join(dir, name)
    if (!existsSync(path)) {
      throw new Error(`expected file ${path} to exist`)
    }
    const content = await readFile(path, 'utf-8')
    if (!content.trim()) {
      throw new Error(`expected file ${path} to be non-empty`)
    }
    result[name] = content
  }
  return {
    dir,
    apiDefinitions: result['apiDefinitions.ts']!,
    globals: result['globals.d.ts']!,
    createApis: result['createApis.ts']!,
    index: result['index.ts']!,
  }
}

/**
 * Setup output dir, run generate(input, output), and return file contents.
 * Property names match the spec (apiDefinitions / globals / createApis / index),
 * even though file names carry extensions.
 */
export async function runGenerate(
  fixtureDir: string,
  options: { globalName?: string } = {},
): Promise<FixtureOutput> {
  const out = await setupOutput(fixtureDir)
  await generate({
    input: join(fixtureDir, 'openapi.json'),
    outputDir: out,
    ...(options.globalName ? { globalName: options.globalName } : {}),
  })
  return expectAllFiles(out)
}

/**
 * Build a regex that matches the needle regardless of exact whitespace.
 *
 * Uses a placeholder to defer whitespace replacement until after escaping,
 * so multi-line needles and inline needles both work uniformly.
 */
export function createStrReg(needle: string): RegExp {
  const WHITESPACE = '__WS__'
  const escaped = needle
    .replace(/\s+/g, WHITESPACE)
    .replace(/[.*+?^${}()|[\]\\*]/g, '\\$&')
    .replace(new RegExp(WHITESPACE, 'g'), '\\s+')
  return new RegExp(escaped)
}
