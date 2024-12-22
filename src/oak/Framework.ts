import { ConsoleLog, Log } from "@danielfroz/slog";
import { type Base, type Controller, Errors, type Framework, MiddlewareCtx, container } from "@danielfroz/sloth";
import { Application, Context, Next, Router } from "jsr:@oak/oak@17.1.3";
import { Middleware, Application as SlothApplication } from "../mod.ts";

const MOD = '@danielfroz/sloth/oak'

export class OakFramework implements Framework<Application> {
  private readonly log: Log
  private readonly application = new Application()

  constructor() {
    this.log = SlothApplication.log ? SlothApplication.log.child({ mod: MOD }): new ConsoleLog({ init: { mod: MOD }})
  }

  app(): Application {
    return this.application
  }

  /**
   * Generates controller using Oak.Router
   */
  createController(controller: Controller): void {
    for(const r of controller.routes) {
      const router = new Router();
      const base = controller.base ?
        controller.base.startsWith('/') ? controller.base: `/${controller.base}`:
        ''
      const endpoint = r.route.endpoint ? 
        r.route.endpoint.startsWith('/') ? r.route.endpoint: `/${r.route.endpoint}`:
        '/'
      const url = `${base}${endpoint}`
      router.post(url, async (ctx: Context) => {
        const log = this.log.child({ handler: url })
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }
          const req = await ctx.request.body.json() as Base
          // If we have ctx.state defined by any Middleware, we add such information to the Command or Query
          const cmdquery = ctx.state != null ? {
            ...ctx.state,
            ...req,
          }: req
          const res = await h.handle(cmdquery)
          ctx.response.status = 200
          ctx.response.body = res
          return
        }
        catch(error: Error | any) {
          if(error instanceof Errors.ArgumentError) {
            log.error({ msg: `bad request; error: ${error.message}` })
            ctx.response.status = 400
            ctx.response.body = {
              error: {
                code: 'badrequest',
                message: error.message
              }
            }
            return
          }
          else if(error instanceof Errors.ApiError) {
            log.error({ msg: `api error; url: ${error.url}, status: ${error.status}, error: ${error.message}` })
            ctx.response.status = error.status,
            ctx.response.body = {
              error: {
                code: 'service.api',
                message: error.message,
              }
            }
            return
          }
          else if(error instanceof Errors.AuthError) {
            log.error({ msg: `auth error; unauthorized, code: ${error.code}, error: ${error.description}` })
            ctx.response.status = 401,
            ctx.response.body = {
              error: {
                code: 'unauthorized',
                message: error.message,
              }
            }
            return
          }
          else if(error instanceof Errors.CodeDescriptionError) {
            log.error({ msg: `service error; unauthorized, code: ${error.code}, error: ${error.description}` })
            ctx.response.status = 500,
            ctx.response.body = {
              error: {
                code: error.code,
                message: error.message,
              }
            }
            return
          }
          else {
            log.error({ msg: `service.error; ${error.message}` })
            ctx.response.status = 500
            ctx.response.body = {
              error: {
                code: 'service.error',
                message: `${error}`
              }
            }
            return
          }
        }
      })

      this.application.use(router.routes())
      this.log.debug({ msg: `registered @Controller ${url} -> ${r.route.handler.name}` })
    }
  }

  createMiddleware(middleware: Middleware): void {
    const mid = async (ctx: Context, next: Next) => {
      const m = middleware as MiddlewareCtx
      await m<Context, Next>(() => ctx, () => next)
    }
    this.application.use(mid)
    this.log.debug(`registered @Middleware: ${middleware.name}`)
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const port = args?.port ?? 80
    await this.application.listen({ port })
  }
}