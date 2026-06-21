import { Types } from "@/types.ts";
import { Log } from "@danielfroz/slog";
import { container, Middleware } from "@danielfroz/sloth";
import { Context, Next } from "@oak/oak";

export interface AuthOptions {
  /** Request paths that bypass auth (exact match), e.g. ['/repo/get']. */
  except?: string[]
}

/**
 * Global authentication middleware — a factory so you can configure exceptions.
 *
 * Applied once in the pipeline `before`, it protects EVERY route except the paths
 * listed in `except`. Global middleware runs before routing resolves a handler,
 * so the "public route" decision is made here by matching the request path — the
 * standard "auth unless <paths>" pattern.
 *
 * (The inverse — auth on only a few routes — is route-scoped middleware:
 * `@Route(path, { use: [auth()] })`. Use whichever has fewer exceptions.)
 *
 * @example
 * ```ts
 * app.Handlers.pipeline({ before: [ auth({ except: ['/repo/get'] }) ] })
 * ```
 */
export const auth = (options?: AuthOptions): Middleware => {
  const except = new Set(options?.except ?? [])

  return async (ctxfn: Middleware.CtxFn<Context>, nextfn: Middleware.NextFn<Next>): Promise<void> => {
    const ctx = ctxfn()
    const next = nextfn()

    // public route — skip auth entirely
    if(except.has(ctx.request.url.pathname)) {
      await next()
      return
    }

    const log = container.resolve<Log>(Types.Log)

    const authorization = ctx.request.headers.get('authorization')
    if(!authorization) {
      log.error({ msg: 'invalid request; token not passed on request; request must come with "Authorization: Token 1" header', url: ctx.request.url.toString() })
      ctx.response.status = 401
      ctx.response.body = {
        error: {
          code: 'unauthorized',
          message: 'access denied'
        }
      }
      return
    }
    if(!authorization?.startsWith('Token')) {
      log.error({ msg: 'invalid token header', url: ctx.request.url.toString() })
      ctx.response.status = 400
      ctx.response.body = {
        error: {
          code: 'token.header',
          message: 'invalid token header'
        }
      }
      return
    }
    // Here we may have the code to validate the authorization header...
    // As this is meant to be a simple example, we simply check if 1
    const token = authorization.substring('Token '.length)
    if(token !== '1') {
      log.warn({ msg: 'token authorization header not found', url: ctx.request.url.toString() })
    }
    else {
      // Passing the authorization token down to the Commands and Queries via
      // ctx.state, so a handler can enforce Authz (cmd.auth) too.
      ctx.state.auth = token
    }

    // call next passing the request down the pipeline
    await next()
  }
}
