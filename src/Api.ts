import { Errors } from "./mod.ts";

type HeadersPredicate = (body?: unknown) => Record<string, string>

export interface ApiInitOptions {
  throwOnError: boolean
  base?: string
  /**
   * Client-wide request timeout in milliseconds, enforced via `AbortSignal.timeout`.
   * When a request exceeds it, `fetch` aborts and the client throws an
   * `ApiError(status: 504, code: 'connection.timeout')`.
   *
   * Opt-in: when `undefined` there is **no** timeout (default behaviour) and the
   * request only fails once the OS-level TCP timeout fires. A per-request
   * `timeout` (see {@link ApiGetOptions.timeout}) overrides this value.
   */
  timeout?: number
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
  /**
   * Per-request timeout in milliseconds; overrides the client-wide
   * {@link ApiInitOptions.timeout}. When both are `undefined` there is no timeout.
   */
  timeout?: number
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
    this.options = {
      base,
      throwOnError: options?.throwOnError ?? true,
      headers: options?.headers,
      timeout: options?.timeout,
    }
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

  async get<R extends object>(options: ApiGetOptions): Promise<R> {
    if(!options.url)
      throw new Errors.ArgumentError('url')

    const url = this._url(options.url)
    const headers = this._headers(options.headers)
    return await this._request<R>('GET', url, headers, undefined, options.timeout)
  }

  async post<R extends object>(options: ApiPostOptions): Promise<R> {
    if(!options.url)
      throw new Errors.ArgumentError('url')
    if(!options.body)
      throw new Errors.ArgumentError('body')

    const url = this._url(options.url)
    const headers = this._headers(options.headers, options.body)
    return await this._request<R>('POST', url, headers, options.body, options.timeout)
  }

  /**
   * Merges per-request headers with the init-time header predicate and forces
   * JSON Accept/Content-Type. `body` is forwarded to the init predicate so it can
   * derive headers from the request payload (@see ApiInitOptions.headers).
   */
  private _headers(
    requestHeaders?: Record<string,string>|HeadersPredicate,
    body?: unknown,
  ): Record<string,string> {
    const headers = {} as Record<string,string>
    if(requestHeaders) {
      const records = typeof(requestHeaders) === 'function' ? requestHeaders(body): requestHeaders
      if(records) {
        for(const [ key, value ] of Object.entries(records)) {
          headers[key] = value
        }
      }
    }
    if(this.options?.headers) {
      const records = this.options.headers(body)
      if(records) {
        for(const [ key, value ] of Object.entries(records)) {
          headers[key] = value
        }
      }
    }
    headers['Accept'] = 'application/json'
    headers['Content-Type'] = 'application/json'
    return headers
  }

  private async _request<R extends object>(
    method: 'GET'|'POST',
    url: string,
    headers: Record<string,string>,
    body?: unknown,
    timeout?: number,
  ): Promise<R> {
    const ms = timeout ?? this.options?.timeout
    let text: string
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body != null ? JSON.stringify(body): undefined,
        signal: ms != null ? AbortSignal.timeout(ms): undefined,
      })
      // Read the raw body first so a non-JSON error page (e.g. a proxy 502) is
      // classified as such instead of being swallowed by a JSON parse failure.
      // A mid-body connection reset surfaces here and is treated as a network error.
      text = await res.text()

      let json: any
      try {
        json = text ? JSON.parse(text): undefined
      }
      catch {
        if(res.status !== 200 && res.status !== 201) {
          // upstream responded, but with a non-JSON body — keep its real status
          throw new Errors.ApiError(method, url, res.status, 'service', this._snippet(text) || res.statusText)
        }
        // 2xx but not JSON — the upstream contract was violated
        throw new Errors.ApiError(method, url, 502, 'response.invalid', `expected JSON response: ${this._snippet(text)}`)
      }

      if(res.status !== 200 && res.status !== 201) {
        if(json?.error?.code) {
          throw new Errors.ApiError(method, url, res.status, json.error.code, json.error.message)
        }
        // upstream error without a coded error result
        throw new Errors.ApiError(method, url, res.status, 'service', JSON.stringify(json))
      }
      return json as R
    }
    catch(error: Errors.ApiError|Error|any) {
      // already-classified ApiError (non-2xx / parse) — re-throw verbatim
      if(error instanceof Errors.ApiError)
        return Promise.reject(error)
      // otherwise it is a fetch/network failure — classify it
      throw this._networkError(method, url, error)
    }
  }

  private _snippet(text: string): string {
    if(!text)
      return ''
    return text.length > 500 ? `${text.substring(0, 500)}…`: text
  }

  /**
   * Classifies a `fetch` rejection (connection refused, timeout, reset, DNS, …)
   * into a granular `ApiError` with a gateway-appropriate status and a dotted
   * code, preserving the original driver message for logs. Works across Deno and
   * Node/undici by inspecting the error name, `error.cause`, and — as a last
   * resort — the message text.
   */
  private _networkError(method: string, url: string, error: any): Errors.ApiError {
    const name = error?.name as string | undefined
    const cause = error?.cause
    // Node/undici expose a POSIX-ish code; Deno exposes an error class name.
    const causeCode = (cause?.code ?? error?.code) as string | undefined
    const causeName = (cause?.name ?? cause?.constructor?.name) as string | undefined
    const raw = [ error?.message, cause?.message, causeCode ]
      .filter(Boolean)
      .join(' - ')
    const text = `${name ?? ''} ${causeName ?? ''} ${raw}`.toLowerCase()

    const has = (...needles: string[]): boolean => needles.some((n) => text.includes(n.toLowerCase()))

    let status = 502
    let code = 'connection'
    let reason = 'network error'

    if(name === 'TimeoutError' || has('etimedout', 'timedout', 'timed out', 'timeout',
        'und_err_connect_timeout', 'und_err_headers_timeout')) {
      status = 504; code = 'connection.timeout'; reason = 'request timed out'
    }
    else if(name === 'AbortError' || has('connectionaborted', 'econnaborted', 'aborted')) {
      status = 502; code = 'connection.aborted'; reason = 'connection aborted'
    }
    else if(has('econnrefused', 'connectionrefused', 'refused')) {
      status = 503; code = 'connection.refused'; reason = 'connection refused'
    }
    else if(has('ehostunreach', 'enetunreach', 'addrnotavailable', 'unreachable')) {
      status = 503; code = 'network.unreachable'; reason = 'network unreachable'
    }
    else if(has('econnreset', 'connectionreset', 'reset')) {
      status = 502; code = 'connection.reset'; reason = 'connection reset'
    }
    else if(has('enotfound', 'eai_again', 'dns', 'name resolution', 'failed to lookup')) {
      status = 502; code = 'dns.notfound'; reason = 'dns lookup failed'
    }

    return new Errors.ApiError(method, url, status, code, `${reason}: ${raw || 'unknown network failure'}`)
  }
}