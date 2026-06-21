import { Types } from "@/types.ts";
import { Log } from "@danielfroz/slog";
import { container, Middleware } from "@danielfroz/sloth";
import { NextFunction, Request, Response } from "express";

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

  return async (reqfn: Middleware.ReqFn<Request>, resfn: Middleware.ResFn<Response>, nextfn: Middleware.NextFn<NextFunction>): Promise<void> => {
    const req = reqfn()
    const res = resfn()
    const next = nextfn()

    // public route — skip auth entirely
    if(except.has(req.path)) {
      await next()
      return
    }

    const log = container.resolve<Log>(Types.Log)

    const authorization = req.get('authorization')
    if(!authorization) {
      log.error({ msg: 'invalid request; token not passed on request; request must come with "Authorization: Token 1" header', url: req.url.toString() })
      res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'access denied'
        }
      })
      return
    }
    if(!authorization?.startsWith('Token')) {
      log.error({ msg: 'invalid token header', url: req.url.toString() })
      await res.status(400).json({
        error: {
          code: 'token.header',
          message: 'invalid token header'
        }
      })
      return
    }
    // Here we may have the code to validate the authorization header...
    // As this is meant to be a simple example, we simply check if 1
    const token = authorization.substring('Token '.length)
    if(token !== '1') {
      log.warn({ msg: 'token authorization header not found', url: req.url.toString() })
    }
    else {
      // Passing the authorization token down to the Commands and Queries via
      // res.locals, so a handler can enforce Authz (cmd.auth) too.
      res.locals.auth = token
    }

    // call next passing the request down the pipeline
    await next()
  }
}
