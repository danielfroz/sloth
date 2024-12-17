import { Errors } from "./mod.ts";

export interface ApiInitOptions {
  base?: string
  throwOnError: boolean
}

export interface ApiGetOptions {
  url: string
  headers?: Record<string, string>
}

export interface ApiPostOptions extends ApiGetOptions {
  body: unknown
}

export interface Api {
  init(options?: ApiInitOptions): Api
  get<R extends object>(options: ApiGetOptions): Promise<R | undefined>
  post<R extends object>(options: ApiPostOptions): Promise<R | undefined>
}

export class ApiFetch implements Api {
  private options?: ApiInitOptions

  init(options?: ApiInitOptions): Api {
    let base: string | undefined
    if(options && options.base && options.base.endsWith('/')) {
      base = options.base.substring(0, options.base.length - 2)
    }
    this.options = { base, throwOnError: options?.throwOnError ?? true }
    return this
  }

  get<R extends object>(options: ApiGetOptions): Promise<R | undefined> {
    return new Promise((resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')

      const correctUrl = !options.url.includes(':') && options.url.startsWith('/') ? options.url: `/${options.url}`
      const url = `${this.options?.base ?? ''}${correctUrl}`
      if(!options.headers) {
        options.headers = {} as Record<string,string>
      }
      options.headers['Accept'] = 'application/json'
      options.headers['Content-Type'] = 'application/json'
      fetch(url, {
        method: 'GET',
        headers: options.headers,
      })
        .then(async (res) => {
          if(res.status !== 200 && res.status !== 201) {
            return reject(new Errors.ApiError('GET', url, res.status, await res.text()))
          }
          const r = await res.json() as unknown as R
          return resolve(r)
        })
        .catch(error => {
          return reject(new Errors.ApiError('GET', url, 500, `${error}`))
        })
    })
  }

  post<R extends object>(options: ApiPostOptions): Promise<R | undefined> {
    return new Promise((resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')
      if(!options.body)
        throw new Errors.ArgumentError('body')

      const correctUrl = !options.url.includes(':') && options.url.startsWith('/') ? options.url: `/${options.url}`
      const url = `${this.options?.base ?? ''}${correctUrl}`
      if(!options.headers) {
        options.headers = {} as Record<string,string>
      }
      
      options.headers['Accept'] = 'application/json'
      options.headers['Content-Type'] = 'application/json'
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(options.body),
        headers: options.headers,
      })
        .then(async (res) => {
          if(res.status !== 200 && res.status !== 201) {
            return reject(new Errors.ApiError('POST', url, res.status, await res.text()))
          }
          const r = await res.json() as unknown as R
          return resolve(r)
        })
        .catch(error => {
          return reject(new Errors.ApiError('POST', url, 500, `${error}`))
        })
    })
  }
}