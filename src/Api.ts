import { Errors } from "./mod.ts";

type HeadersPredicate = (body?: unknown) => Record<string, string>

export interface ApiInitOptions {
  throwOnError: boolean
  base?: string
  /**
   * Allows to add custom header generation logic based on request body.
   * Useful for middleware processing; as body is not necessary for headers parsing
   * 
   * @example
   * ```ts
   * const api = new ApiFetch().init({
   *  base: 'https://base_service_com/api',
   *  throwOnError: true,
   *  headers: function (body: unknown) {
   *    const { authorId, correlationId } = body as { authorId: string, correlationId: string }
   *    return {
   *      'X-Author-ID': authorId,
   *      'X-Correlation-ID': correlationId
   *    }
   *  },
   * })
   * ```
   */
  headers?: HeadersPredicate
}

export interface ApiGetOptions {
  /**
   * Request url. Url can be absolute or relative
   * 
   * @example Relative request
   * ```ts
   * const { user } = api.get<Cqrs.QueryResult>({ url: `/user/${user.id}` })
   * ```
   * 
   * @example Absolute request
   * ```ts
   * const { user } = api.get<Cqrs.QueryResult>({
   *   url: 'https://www.example.com/api/user/get',
   * })
   * ```
   */
  url: string
  /**
   * Headers or HeadersPredicate.
   * For headers predicate, @see ApiInitOptions.headers
   */
  headers?: Record<string, string>|HeadersPredicate
}

export interface ApiPostOptions extends ApiGetOptions {
  body: unknown
}

export interface Api {
  init(options?: ApiInitOptions): Api
  get<R extends object>(options: ApiGetOptions): Promise<R>
  post<R extends object>(options: ApiPostOptions): Promise<R>
}

export class ApiFetch implements Api {
  private options?: ApiInitOptions

  init(options?: ApiInitOptions): Api {
    let base = options?.base
    if(base && base.endsWith('/')) {
      base = base.substring(0, base.length - 1)
    }
    this.options = { base, throwOnError: options?.throwOnError ?? true, headers: options?.headers }
    return this
  }

  private _url(url: string): string {
    if(url.includes(':')) {
      return url
    }
    if(this.options?.base) {
      if(url.startsWith('/'))
        return `${this.options.base}${url}`
      else
        return `${this.options.base}/${url}`
    }
    throw new Errors.ArgumentError(`invalid url: ${url}`)
  }

  get<R extends object>(options: ApiGetOptions): Promise<R> {
    const initOptions = this.options
    return new Promise(async (resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')

      const url = this._url(options.url)
      const headers = {} as Record<string,string>
      if(options.headers) {
        let records = typeof(options.headers) === 'function' ? options.headers(): options.headers
        if(records) {
          for(const [ key, value ] of Object.entries(records)) {
            headers[key] = value
          }
        }
      }
      if(initOptions?.headers) {
        const records = initOptions.headers()
        if(records) {
          for(const [ key, value ] of Object.entries(records)) {
            headers[key] = value
          }
        }
      }
      headers['Accept'] = 'application/json'
      headers['Content-Type'] = 'application/json'
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers,
        })
        const json = await res.json()
        if(res.status !== 200 && res.status !== 201) {
          if(json.error?.code) {
            throw new Errors.ApiError('GET', url, res.status, json.error?.code, json.error?.message)
          }
          else {
            // generic error code
            throw new Errors.ApiError('GET', url, res.status, 'service', JSON.stringify(json))
          }
        }
        return resolve(json as R)
      }
      catch(error: Errors.ApiError|Error|any) {
        if(error.code)
          return reject(error)
        // generic error
        return reject(new Errors.ApiError('GET', url, 500, 'service', error.message))
      }
    })
  }

  post<R extends object>(options: ApiPostOptions): Promise<R> {
    const initOptions = this.options
    return new Promise(async (resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')
      if(!options.body)
        throw new Errors.ArgumentError('body')

      const url = this._url(options.url)
      const headers = {} as Record<string,string>
      if(options.headers) {
        const records = typeof(options.headers) === 'function' ? options.headers(): options.headers;
        if(records) {
          for(const [ key, value ] of Object.entries(records)) {
            headers[key] = value
          }
        }
      }
      if(initOptions?.headers) {
        const records = initOptions.headers(options.body)
        if(records) {
          for(const [ key, value ] of Object.entries(records)) {
            headers[key] = value
          }
        }
      }
      headers['Accept'] = 'application/json'
      headers['Content-Type'] = 'application/json'
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: JSON.stringify(options.body),
          headers,
        })
        const json = await res.json()
        if(res.status !== 200 && res.status !== 201) {
          if(json.error?.code) {
            throw new Errors.ApiError('POST', url, res.status, json.error?.code, json.error?.message)
          }
          else {
            // generic error code
            throw new Errors.ApiError('POST', url, res.status, 'service', JSON.stringify(json))
          }
        }
        return resolve(json as R)
      }
      catch(error: Errors.ApiError|Error|any) {
        if(error.code)
          return reject(error)
        // generic error
        return reject(new Errors.ApiError('POST', url, 500, 'service', error.message))
      }
    })
  }
}