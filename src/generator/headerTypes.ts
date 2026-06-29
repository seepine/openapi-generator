/**
 * Header imports + type aliases for globals.d.ts, mirroring
 * src/templates/globals.d.handlebars from alovajs/wormhole.
 *
 * `typeof import('./index')['alovaInstance']` is used (not the abstract
 * `Alova` symbol) so Alova2MethodConfig/Alova2Method generics are inferred
 * from the user's actual alova instance — the abstract symbol collapses
 * to `any` once Alova uses AlovaGenerics.
 *
 * The Alova2MethodConfig / Alova2Method / ExtractUserDefinedTransformed
 * block is kept verbatim to stay valid for both alova v2 and v3.
 */
export const IMPORTS = [
  "import type { Alova, AlovaMethodCreateConfig, AlovaGenerics, Method } from 'alova';",
  "import type { $$userConfigMap, alovaInstance } from './index';",
  "import type apiDefinitions from './apiDefinitions';",
].join('\n')

export const HEADER_TYPES = `type CollapsedAlova = typeof alovaInstance;
type UserMethodConfigMap = typeof $$userConfigMap;

type Alova2MethodConfig<Responded> =
  CollapsedAlova extends Alova<
    AlovaGenerics<
      any,
      any,
      infer RequestConfig,
      infer Response,
      infer ResponseHeader,
      infer L1Cache,
      infer L2Cache,
      infer SE
    >
  >
    ? Omit<
        AlovaMethodCreateConfig<
          AlovaGenerics<Responded, any, RequestConfig, Response, ResponseHeader, L1Cache, L2Cache, SE>,
          any,
          Responded
        >,
        'params'
      >
    : never;

// Extract the return type of transform function that define in $$userConfigMap, if it not exists, use the default type.
type ExtractUserDefinedTransformed<
  DefinitionKey extends keyof typeof apiDefinitions,
  Default
> = DefinitionKey extends keyof UserMethodConfigMap
  ? UserMethodConfigMap[DefinitionKey]['transform'] extends (...args: any[]) => any
    ? Awaited<ReturnType<UserMethodConfigMap[DefinitionKey]['transform']>>
    : Default
  : Default;
type Alova2Method<
  Responded,
  DefinitionKey extends keyof typeof apiDefinitions,
  CurrentConfig extends Alova2MethodConfig<any>
> =
  CollapsedAlova extends Alova<
    AlovaGenerics<
      any,
      any,
      infer RequestConfig,
      infer Response,
      infer ResponseHeader,
      infer L1Cache,
      infer L2Cache,
      infer SE
    >
  >
    ? Method<
        AlovaGenerics<
          CurrentConfig extends undefined
            ? ExtractUserDefinedTransformed<DefinitionKey, Responded>
            : CurrentConfig['transform'] extends (...args: any[]) => any
              ? Awaited<ReturnType<CurrentConfig['transform']>>
              : ExtractUserDefinedTransformed<DefinitionKey, Responded>,
          any,
          RequestConfig,
          Response,
          ResponseHeader,
          L1Cache,
          L2Cache,
          SE
        >
      >
    : never;`
