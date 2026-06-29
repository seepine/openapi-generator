import { renderHeaderComment } from './header'

const INDEX_TEMPLATE = `import { createAlova } from 'alova'
import fetchAdapter from 'alova/fetch'
import { createApis, withConfigType, mountApis } from './createApis'

export const alovaInstance = createAlova({
  baseURL: '/api',
  cacheFor: null,
  requestAdapter: fetchAdapter(),
  beforeRequest: (method) => {},
  responded: async (res) => {
    return res.json()
  },
})

export const $$userConfigMap = withConfigType({})

const Apis = createApis(alovaInstance, $$userConfigMap)

mountApis(Apis)

export default Apis
`

/**
 * Hardcoded copy of docs/template/createApis.ts.txt — keep in sync.
 *
 * `\`` (literal backtick) escapes keep the embedded backticks in the output
 * literal. `${...}` placeholders in the output use real interpolation here.
 * The leading docblock is supplied by `renderHeaderComment` so it stays in
 * sync with apiDefinitions.ts and globals.d.ts.
 */
const CREATE_APIS_TEMPLATE = `import type { Alova, MethodType, AlovaGenerics, AlovaMethodCreateConfig } from 'alova';
import { Method } from 'alova';
import apiDefinitions from './apiDefinitions';

const cache = Object.create(null);
const createFunctionalProxy = (array: (string | symbol)[], alovaInstance: Alova<AlovaGenerics>, configMap: any) => {
  const apiPathKey = array.join('.') as keyof typeof apiDefinitions;
  if (cache[apiPathKey]) {
    return cache[apiPathKey];
  }
  // create a new proxy instance
  const proxy = new Proxy(function () {}, {
    get(_, property) {
      // record the target property, so that it can get the completed accessing paths
      const newArray = [...array, property];
      // always return a new proxy to continue recording accessing paths.
      return createFunctionalProxy(newArray, alovaInstance, configMap);
    },
    apply(_, __, [config]) {
      const apiItem = apiDefinitions[apiPathKey];
      if (!apiItem) {
        throw new Error(\`the api path of \\\`\${apiPathKey}\\\` is not found\`);
      }
      const mergedConfig = {
        ...configMap[apiPathKey],
        ...config
      };
      const [method, url] = apiItem;
      const pathParams = mergedConfig.pathParams;
      const urlReplaced = url!.replace(/\\{([^}]+)\\}/g, (_, key) => {
        const pathParam = pathParams[key];
        return pathParam;
      });
      delete mergedConfig.pathParams;
      let data = mergedConfig.data;
      if (Object.prototype.toString.call(data) === '[object Object]' && typeof FormData !== 'undefined') {
        let hasBlobData = false;
        const formData = new FormData();
        for (const key in data) {
          if (Array.isArray(data[key])) {
            for (const ele of data[key]) {
              formData.append(key, ele);
              if (ele instanceof Blob) {
                hasBlobData = true;
              }
            }
          } else {
            formData.append(key, data[key]);
            if (data[key] instanceof Blob) {
              hasBlobData = true;
            }
          }
        }
        data = hasBlobData ? formData : data;
      }
      return new Method(method!.toUpperCase() as MethodType, alovaInstance, urlReplaced, mergedConfig, data);
    }
  });
  cache[apiPathKey] = proxy;
  return proxy;
};

export const createApis = (alovaInstance: Alova<AlovaGenerics>, configMap: any) => {
  const __GLOBAL_NAME__ = new Proxy({} as __GLOBAL_NAME__, {
    get(_, property) {
      return createFunctionalProxy([property], alovaInstance, configMap);
    }
  });
  return __GLOBAL_NAME__;
};

export const mountApis = (__GLOBAL_NAME__: __GLOBAL_NAME__) => {
  // define global variable \`__GLOBAL_NAME__\`
  (globalThis as any).__GLOBAL_NAME__ = __GLOBAL_NAME__;
};

type MethodConfig<T> = AlovaMethodCreateConfig<
  (typeof import('./index'))['alovaInstance'] extends Alova<infer AG> ? AG : any,
  any,
  T
>;
type APISofParameters<Tag extends string, Url extends string> = Tag extends keyof __GLOBAL_NAME__
  ? Url extends keyof __GLOBAL_NAME__[Tag]
    ? __GLOBAL_NAME__[Tag][Url] extends (...args: any) => any
      ? Parameters<__GLOBAL_NAME__[Tag][Url]>
      : any
    : any
  : any;
type MethodsConfigMap = {
  [P in keyof typeof import('./apiDefinitions').default]?: MethodConfig<
    P extends \`\${infer Tag}.\${infer Url}\` ? Parameters<NonNullable<APISofParameters<Tag, Url>[0]>['transform']>[0] : any
  >;
};
export const withConfigType = <Config extends MethodsConfigMap>(config: Config) => config;
`

export function renderIndex(): string {
  return INDEX_TEMPLATE
}

export interface RenderCreateApisContext {
  globalName: string
  title: string
  version: string
  openapiVersion: string
}

export function renderCreateApis(ctx: RenderCreateApisContext): string {
  const body = CREATE_APIS_TEMPLATE.replaceAll(
    '__GLOBAL_NAME__',
    ctx.globalName,
  )
  return [renderHeaderComment(ctx), body].join('\n\n')
}
