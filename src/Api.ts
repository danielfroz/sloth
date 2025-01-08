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
  get<R extends object>(options: ApiGetOptions): Promise<R>
  post<R extends object>(options: ApiPostOptions): Promise<R>
}

export class ApiFetch implements Api {
  private options?: ApiInitOptions

  init(options?: ApiInitOptions): Api {
    let base = options?.base
    if(base && base.endsWith('/')) {
      base = base.substring(0, base.length - 2)
    }
    this.options = { base, throwOnError: options?.throwOnError ?? true }
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
    return new Promise(async (resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')

      const url = this._url(options.url)
      if(!options.headers) {
        options.headers = {} as Record<string,string>
      }
      options.headers['Accept'] = 'application/json'
      options.headers['Content-Type'] = 'application/json'
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: options.headers,
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

  post<R extends object>(options: ApiPostOptions): Promise<R> {
    return new Promise(async (resolve, reject) => {
      if(!options.url)
        throw new Errors.ArgumentError('url')
      if(!options.body)
        throw new Errors.ArgumentError('body')

      const url = this._url(options.url)
      if(!options.headers) {
        options.headers = {} as Record<string,string>
      }
      
      options.headers['Accept'] = 'application/json'
      options.headers['Content-Type'] = 'application/json'
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: JSON.stringify(options.body),
          headers: options.headers,
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