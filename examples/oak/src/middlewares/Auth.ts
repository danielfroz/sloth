import { Types } from "@/types.ts";
import { Log } from "@danielfroz/slog";
import { container, Middleware } from "@danielfroz/sloth";
import { Context, Next } from "@oak/oak";

/**
 * This is the Sloth Middleware for Authentication of the Controllers
 * We may apply the logic as we want... using the standard Oak.use() interface
 * Note that this is exactly what you have from CtxFn and NextFn.
 * 
 * The idea is not to hide the Framework implementation. Rather than that we embrace the powerful APIs
 * and features and just integrate them with DI and CQRS management simplicity of Sloth.
 */
export const AuthMiddleware = async (ctxfn: Middleware.CtxFn<Context>, nextfn: Middleware.NextFn<Next>): Promise<void> => {
  const ctx = ctxfn()
  const next = nextfn()
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
    // Passing the authorization token down the the Commands and Queries...
    // So you can validate if the token is valid or not directly from the CommandHandler
    // This allow you to enforce both Auth & Authz
    ctx.state.auth = token
  }

  // call next passing the request without proper validation
  await next()
}