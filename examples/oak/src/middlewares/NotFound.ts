import { Types } from "@/types.ts";
import { container, Middleware } from "@danielfroz/sloth";
import { Context, Next } from "@oak/oak";

/**
 * You may want to customize the Not Found of API using a Middleware like this one
 */
export const NotFoundMiddleware = async (ctxfn: Middleware.CtxFn<Context>, _nextfn: Middleware.NextFn<Next>): Promise<void> => {
  // accessing Oak.Context
  const ctx = ctxfn()

  const log = container.resolve(Types.Log)
  log.info({ msg: `component not found`, url: ctx.request.url.toString() })

  ctx.response.status = 404
  ctx.response.body = {
    error: {
      code: 'notfound',
      message: 'component not found'
    }
  }
}