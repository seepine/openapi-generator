import { describe, it, expect, vi } from 'vitest'
import { parseSchema } from '../../src/parser/parsers'
import {
  printType,
  printObjectInline,
  printObjectMultiline,
} from '../../src/parser/printers'
import type { JsonSchema } from '../../src/types'
import type { ParserContext } from '../../src/parser/types'

function makeCtx(schemas: Record<string, JsonSchema> = {}): ParserContext {
  return { schemas, refStack: new Set(), depth: 0 }
}

function parse(schema: JsonSchema | undefined, ctx?: ParserContext): string {
  return printType(parseSchema(ctx ?? makeCtx(), schema))
}

function schema(obj: Record<string, unknown>): JsonSchema {
  // For test convenience: always tag as 3.0 schema since most fields are common.
  return { _version: '3.0', ...obj } as unknown as JsonSchema
}

describe('parser — primitives', () => {
  it('1. type: string → string', () => {
    expect(parse(schema({ type: 'string' }))).toBe('string')
  })

  it('2. type: string, enum → literalUnion', () => {
    expect(parse(schema({ type: 'string', enum: ['a', 'b'] }))).toBe(
      "'a' | 'b'",
    )
  })

  it('3. type: string, const → literal', () => {
    expect(parse(schema({ type: 'string', const: 'x' }))).toBe("'x'")
  })

  it('4a. type: number → number', () => {
    expect(parse(schema({ type: 'number' }))).toBe('number')
  })

  it('4b. type: integer → number', () => {
    expect(parse(schema({ type: 'integer' }))).toBe('number')
  })

  it('5. type: boolean → boolean', () => {
    expect(parse(schema({ type: 'boolean' }))).toBe('boolean')
  })

  it('6. type: boolean, const: true → true (NOT boolean)', () => {
    expect(parse(schema({ type: 'boolean', const: true }))).toBe('true')
  })

  it('7. type: boolean, const: false → false (NOT boolean)', () => {
    expect(parse(schema({ type: 'boolean', const: false }))).toBe('false')
  })

  it('8. type: null → null', () => {
    expect(parse(schema({ type: 'null' }))).toBe('null')
  })
})

describe('parser — arrays', () => {
  it('9. array with items → Array<itemType>', () => {
    expect(parse(schema({ type: 'array', items: { type: 'string' } }))).toBe(
      'Array<string>',
    )
  })

  it('10. array without items → Array<unknown>', () => {
    expect(parse(schema({ type: 'array' }))).toBe('Array<unknown>')
  })
})

describe('parser — objects', () => {
  it('11. object with one property → inline single (no required = optional)', () => {
    const out = printObjectInline(
      parseSchema(
        makeCtx(),
        schema({ type: 'object', properties: { a: { type: 'string' } } }),
      ),
    )
    expect(out).toBe('{ a?: string; }')
  })

  it('11b. object with required prop', () => {
    const out = printObjectInline(
      parseSchema(
        makeCtx(),
        schema({
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
        }),
      ),
    )
    expect(out).toBe('{ a: string; }')
  })

  it('12. object with required vs optional fields', () => {
    const out = printObjectInline(
      parseSchema(
        makeCtx(),
        schema({
          type: 'object',
          properties: { a: { type: 'string' }, b: { type: 'string' } },
          required: ['a'],
        }),
      ),
    )
    expect(out).toBe('{ a: string; b?: string; }')
  })

  it('12b. property with undefined schema → unknown type', () => {
    // Schema declares the key but its schema is missing → fall back to unknown
    // so downstream callers see a defined shape instead of crashing.
    const out = printObjectInline(
      parseSchema(
        makeCtx(),
        schema({ type: 'object', properties: { a: undefined } }),
      ),
    )
    expect(out).toBe('{ a?: unknown; }')
  })

  it('12c. nullable: true on a property → union with null', () => {
    const out = printObjectInline(
      parseSchema(
        makeCtx(),
        schema({
          type: 'object',
          properties: { a: { type: 'string', nullable: true } },
        }),
      ),
    )
    expect(out).toBe('{ a?: string | null; }')
  })
})

describe('parser — oneOf / anyOf / allOf', () => {
  it('13. oneOf with 3 branches → union of 3', () => {
    const s = schema({
      oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
    })
    expect(parse(s)).toBe('string | number | boolean')
  })

  it('14. anyOf with 3 branches → union of 3', () => {
    const s = schema({
      anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
    })
    expect(parse(s)).toBe('string | number | boolean')
  })

  it('15. allOf merges properties', () => {
    const s = schema({
      allOf: [
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
        },
        {
          type: 'object',
          properties: { b: { type: 'number' } },
          required: ['b'],
        },
      ],
    })
    const out = printObjectInline(parseSchema(makeCtx(), s))
    expect(out).toBe('{ a: string; b: number; }')
  })

  it('16. allOf conflict → first wins', () => {
    const s = schema({
      allOf: [
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
        },
        {
          type: 'object',
          properties: { a: { type: 'number' } },
          required: ['a'],
        },
      ],
    })
    const out = printObjectInline(parseSchema(makeCtx(), s))
    expect(out).toBe('{ a: string; }')
  })

  it('16b. allOf with a non-object branch warns and continues merging', () => {
    // Defensive: a primitive branch in allOf can't contribute properties —
    // the merge step warns and skips it, but other valid branches still
    // contribute their keys.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = schema({
      allOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
        },
      ],
    })
    const out = printObjectInline(parseSchema(makeCtx(), s))
    expect(out).toBe('{ a: string; }')
    expect(
      warnSpy.mock.calls.some((c) =>
        String(c[0]).includes('allOf branch is not an object'),
      ),
    ).toBe(true)
    warnSpy.mockRestore()
  })
})

describe('parser — $ref', () => {
  it('17. $ref inline-expands the referenced schema', () => {
    const ctx = makeCtx({ Foo: schema({ type: 'string' }) })
    expect(parse(schema({ $ref: '#/components/schemas/Foo' }), ctx)).toBe(
      'string',
    )
  })

  it('17b. $ref to object inlines structure', () => {
    const ctx = makeCtx({
      Foo: schema({
        type: 'object',
        properties: { x: { type: 'number' } },
        required: ['x'],
      }),
    })
    expect(
      printObjectInline(
        parseSchema(ctx, schema({ $ref: '#/components/schemas/Foo' })),
      ),
    ).toBe('{ x: number; }')
  })
})

describe('parser — nullable / type-array', () => {
  it('18. nullable: true → T | null', () => {
    expect(parse(schema({ type: 'string', nullable: true }))).toBe(
      'string | null',
    )
  })

  it('19. 3.1 type array with null → string | null', () => {
    const s = {
      _version: '3.1',
      type: ['string', 'null'],
    } as unknown as JsonSchema
    expect(parse(s)).toBe('string | null')
  })

  it('19b. 3.1 type array without null collapses to single', () => {
    const s = { _version: '3.1', type: ['string'] } as unknown as JsonSchema
    expect(parse(s)).toBe('string')
  })

  it('19c. 3.1 type array multi → union', () => {
    const s = {
      _version: '3.1',
      type: ['string', 'number'],
    } as unknown as JsonSchema
    expect(parse(s)).toBe('string | number')
  })

  it('19d. 3.1 type array with only `null` → null primitive', () => {
    // Edge case: a schema that declares `type: ['null']` and nothing else —
    // after filtering out `null` from the type list, no subs remain, so the
    // parser must collapse to the `null` primitive rather than `unknown`.
    const s = { _version: '3.1', type: ['null'] } as unknown as JsonSchema
    expect(parse(s)).toBe('null')
  })
})

describe('parser — fallback / unknown', () => {
  it('20. format is a validation hint — non-binary string format stays string', () => {
    expect(parse(schema({ type: 'string', format: 'date-time' }))).toBe(
      'string',
    )
    expect(parse(schema({ type: 'string', format: 'email' }))).toBe('string')
    expect(parse(schema({ type: 'string', format: 'cuid' }))).toBe('string')
  })

  it('20b. format: binary on string → Blob', () => {
    // OpenAPI: `type: string, format: binary` is the canonical shape for
    // file / blob payloads. The generator surfaces that as the DOM global
    // `Blob`, which most consumers either pass through alova or post-
    // process into a File / ArrayBuffer.
    expect(parse(schema({ type: 'string', format: 'binary' }))).toBe('Blob')
  })

  it('20b2. contentEncoding: binary on string → Blob', () => {
    // JSON-Schema spelling of the same intent (no `format` field).
    expect(
      parse(
        schema({
          type: 'string',
          contentEncoding: 'binary',
        }),
      ),
    ).toBe('Blob')
  })

  it('20b3. format: binary + nullable: true → Blob | null', () => {
    expect(
      parse(schema({ type: 'string', format: 'binary', nullable: true })),
    ).toBe('Blob | null')
  })

  it('20b4. format: binary on a non-string type → Blob', () => {
    // binary is a type-system override, not a per-`type` decoration: when the
    // schema carries `format: 'binary'` we collapse to Blob regardless of
    // the declared `type`. A number with the same hint is almost certainly a
    // mistyped doc, but falling back to Blob matches the binary intent and
    // never silently widens to unknown.
    expect(parse(schema({ type: 'number', format: 'binary' }))).toBe('Blob')
  })

  it('20c. unknown shape → unknown', () => {
    expect(parse(undefined)).toBe('unknown')
  })

  it('20d. empty schema {} → unknown (forwarded as object with no props)', () => {
    // empty schema → forward sees no const/enum/oneOf/anyOf/allOf/type → 'unknown'
    expect(parse(schema({}))).toBe('unknown')
  })
})

describe('parser — cycle / depth', () => {
  it('21. cycle (A → A via property) does not throw, returns unknown for self-ref', () => {
    const ctx = makeCtx({
      A: schema({
        type: 'object',
        properties: { self: { $ref: '#/components/schemas/A' } },
      }),
    })
    // Should not throw
    const out = printObjectInline(
      parseSchema(ctx, schema({ $ref: '#/components/schemas/A' })),
    )
    expect(out).toContain('unknown')
    expect(out).toContain('self')
  })

  it('21b. excessive depth → produces unknown inside (no throw, no infinite recursion)', () => {
    // Build a deeply nested object schema: { type: 'object', properties: { a: <prev> } }
    let current: JsonSchema = schema({ type: 'string' })
    for (let i = 0; i < 35; i++) {
      current = schema({ type: 'object', properties: { a: current } })
    }
    const out = parse(current)
    // Should produce something containing unknown deep inside, not throw.
    expect(out).toContain('unknown')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('parser — const discriminator', () => {
  it('22. oneOf const-discriminator branches are NOT merged (demo pattern: const-as-field)', () => {
    // Demo pattern: discriminator is a property whose value has `const`.
    const s = schema({
      oneOf: [
        {
          type: 'object',
          properties: {
            channel: { const: 'email' },
            email: { type: 'string' },
          },
          required: ['channel', 'email'],
        },
        {
          type: 'object',
          properties: {
            channel: { const: 'phone' },
            phone: { type: 'string' },
          },
          required: ['channel', 'phone'],
        },
      ],
    })
    const out = parse(s)
    expect(out).toContain(' | ')
    expect(out).toContain("'email'")
    expect(out).toContain("'phone'")
    expect(out).toContain('channel')
    // explicit: not merged into a single object
    expect(out).not.toBe(
      "{ channel: 'email' | 'phone'; email: string; phone: string; }",
    )
  })

  it('22b. oneOf with const-at-root produces union of literals (not merged to string)', () => {
    const s = schema({
      oneOf: [{ const: 'a' }, { const: 'b' }],
    })
    expect(parse(s)).toBe("'a' | 'b'")
  })
})

describe('parser — field order', () => {
  it('23. preserves property declaration order', () => {
    const s = schema({
      type: 'object',
      properties: {
        z: { type: 'string' },
        a: { type: 'number' },
        m: { type: 'boolean' },
      },
      required: ['z', 'a', 'm'],
    })
    const out = printObjectInline(parseSchema(makeCtx(), s))
    // Declaration order is z, a, m — output must reflect that.
    expect(out).toBe('{ z: string; a: number; m: boolean; }')
  })
})

describe('parser — enum branches', () => {
  it('mixed enum (string+number+bool) falls back to union of literals', () => {
    const out = parse(schema({ enum: ['a', 1, true] }))
    expect(out).toContain("'a'")
    expect(out).toContain('1')
    expect(out).toContain('true')
    expect(out).toContain(' | ')
  })

  it('empty enum returns unknown', () => {
    expect(parse(schema({ enum: [] }))).toBe('unknown')
  })

  it('number enum produces literalUnion', () => {
    const out = parse(schema({ type: 'number', enum: [1, 2, 3] }))
    expect(out).toBe('1 | 2 | 3')
  })

  it('single-element string enum produces single literal', () => {
    const out = parse(schema({ type: 'string', enum: ['only'] }))
    expect(out).toBe("'only'")
  })

  it('enum with non-primitive (object) values → unknown fallback inside union', () => {
    const out = parse(schema({ enum: [{ foo: 'bar' }] }))
    // Object literal maps to unknown; result is the unknown primitive
    expect(out).toBe('unknown')
  })

  // enum is INDEPENDENT of `type` — OpenAPI allows schemas with only `enum`.
  // dispatch priority: enum beats type (spec §3.3.5).
  it('string enum without type → literalUnion', () => {
    expect(parse(schema({ enum: ['a', 'b'] }))).toBe("'a' | 'b'")
  })

  it('number enum without type → literalUnion', () => {
    expect(parse(schema({ enum: [1, 2, 3] }))).toBe('1 | 2 | 3')
  })

  it('boolean enum without type → literalUnion', () => {
    expect(parse(schema({ enum: [true, false] }))).toBe('true | false')
  })

  it('single-element enum without type collapses to one literal', () => {
    expect(parse(schema({ enum: ['only'] }))).toBe("'only'")
  })
})

describe('parser — const branches', () => {
  it('const with object value falls back to unknown', () => {
    const out = parse(schema({ const: { foo: 'bar' } }))
    expect(out).toBe('unknown')
  })

  it('const with array value falls back to unknown', () => {
    const out = parse(schema({ const: [1, 2, 3] }))
    expect(out).toBe('unknown')
  })

  it('const: null → null literal', () => {
    expect(parse(schema({ const: null }))).toBe('null')
  })

  it('const: 42 → number literal', () => {
    expect(parse(schema({ const: 42 }))).toBe('42')
  })

  // const is INDEPENDENT of `type` — it must not degrade to the primitive.
  it('const: 1 (no type) → 1, not number', () => {
    expect(parse(schema({ const: 1 }))).toBe('1')
  })

  it('const: "x" (no type) → "x", not string', () => {
    expect(parse(schema({ const: 'x' }))).toBe("'x'")
  })

  it('const: true (no type) → true, not boolean', () => {
    expect(parse(schema({ const: true }))).toBe('true')
  })

  it('const: false (no type) → false, not boolean', () => {
    expect(parse(schema({ const: false }))).toBe('false')
  })

  // dispatch priority: const > type. Even with type: 'string' set,
  // const: 'x' wins and produces the literal.
  it('const: "x" with type: "string" → "x" (const wins over type)', () => {
    expect(parse(schema({ type: 'string', const: 'x' }))).toBe("'x'")
  })
})

describe('parser — dispatch priority', () => {
  it('const > type: const produces literal even when type is set', () => {
    expect(parse(schema({ type: 'string', const: 'x' }))).toBe("'x'")
    expect(parse(schema({ type: 'number', const: 1 }))).toBe('1')
    expect(parse(schema({ type: 'boolean', const: false }))).toBe('false')
  })

  it('enum > type: enum produces literalUnion even when type is set', () => {
    expect(parse(schema({ type: 'string', enum: ['a', 'b'] }))).toBe(
      "'a' | 'b'",
    )
  })

  it('const > format: format is a validation hint and never narrows the type', () => {
    // Without const: format ignored, type stays 'string'
    expect(parse(schema({ type: 'string', format: 'email' }))).toBe('string')
    // With const: const produces literal; format is irrelevant
    expect(parse(schema({ type: 'string', const: 'x', format: 'email' }))).toBe(
      "'x'",
    )
    // binary format is a load-bearing exception (see parser — primitives)
    expect(
      parse(schema({ type: 'string', const: 'x', format: 'binary' })),
    ).toBe("'x'")
  })
})

describe('parser — reference branches', () => {
  it('ref to non-existent schema returns unknown', () => {
    const out = parse(schema({ $ref: '#/components/schemas/NonExistent' }))
    expect(out).toBe('unknown')
  })

  it('ref to cross-file $ref returns unknown', () => {
    const out = parse(schema({ $ref: 'external.json#/Foo' }))
    expect(out).toBe('unknown')
  })

  it('ref using definitions/ path resolves', () => {
    const ctx = makeCtx({ Bar: schema({ type: 'number' }) })
    expect(parse(schema({ $ref: '#/definitions/Bar' }), ctx)).toBe('number')
  })

  it('self-recursive ref returns unknown (cycle guard)', () => {
    const ctx = makeCtx({
      Loop: schema({
        type: 'object',
        properties: { self: { $ref: '#/components/schemas/Loop' } },
      }),
    })
    const out = printObjectInline(
      parseSchema(ctx, schema({ $ref: '#/components/schemas/Loop' })),
    )
    expect(out).toContain('unknown')
    expect(out).toContain('self')
  })
})

describe('parser — printers multiline', () => {
  it('multiline expansion: union of objects in property', () => {
    const s = schema({
      type: 'object',
      properties: {
        data: {
          oneOf: [
            {
              type: 'object',
              properties: {
                channel: { const: 'email' },
                email: { type: 'string' },
              },
              required: ['channel', 'email'],
            },
            {
              type: 'object',
              properties: {
                channel: { const: 'phone' },
                phone: { type: 'string' },
              },
              required: ['channel', 'phone'],
            },
          ],
        },
      },
      required: ['data'],
    })
    const out = printObjectMultiline(parseSchema(makeCtx(), s), '  ')
    // multiline object: each field on its own line; data is a union of two objects
    expect(out).toContain('data:')
    expect(out).toContain("channel: 'email'")
    expect(out).toContain("channel: 'phone'")
    expect(out).toContain(' | ')
    expect(out.split('\n').length).toBeGreaterThan(3)
  })

  it('multiline: simple object collapses to inline', () => {
    const s = schema({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    })
    const out = printObjectMultiline(parseSchema(makeCtx(), s), '')
    expect(out).toBe('{ a: string; }')
  })

  it('multiline: array-of-objects property reuses object multiline', () => {
    // Array properties aren't object/union, so printPropertyTypeMultiline
    // falls through to printType at the bottom — but for items of type
    // object, the inner printing is done by printType (inline form).
    const s = schema({
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
          },
        },
      },
      required: ['items'],
    })
    const out = printObjectMultiline(parseSchema(makeCtx(), s), '')
    expect(out).toContain('items:')
    expect(out).toContain('Array<')
    expect(out).toContain('id: string')
  })
})
