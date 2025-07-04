import { type Base, BaseResult, type Controller, Errors, type Framework, Middleware, MiddlewareCtx, container } from "@danielfroz/sloth";
import { Application, Context, Next, Router } from "jsr:@oak/oak@17.1.4";
import { Application as SlothApplication } from "../mod.ts";

const MOD = '@danielfroz/sloth/oak'

export class OakFramework implements Framework<Application> {
  private readonly application = new Application()

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
        const log = SlothApplication.log.child({ handler: url })

        // this allow to catch the ID and SID from the request to pass along the error response
        const rmeta: Partial<BaseResult> = {}
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }

          const req = await ctx.request.body.json() as Base
          rmeta.id = req.id
          rmeta.sid = req.sid

          // If we have ctx.state defined by any Middleware, we add such information to the Command or Query
          const cmdquery = ctx.state != null ? {
            ...ctx.state,
            ...req,
          }: req

          const res = await h.handle(cmdquery) as BaseResult
          ctx.response.status = 200
          ctx.response.body = {
            ...rmeta,
            ...res 
          }
          return
        }
        catch(error: Error | any) {
          if(error instanceof Errors.ArgumentError) {
            log.error({
              sid: rmeta.sid,
              msg: `bad request; error: ${error.message}`
            })
            ctx.response.status = 400
            ctx.response.body = {
              ...rmeta,
              error: {
                code: 'badrequest',
                message: error.message
              }
            }
            return
          }
          else if(error instanceof Errors.ApiError) {
            log.error({
              sid: rmeta.sid,
              url: error.url,
              status: error.status,
              code: error.code,
              msg: error.message,
            })
            ctx.response.status = error.status,
            ctx.response.body = {
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            }
            return
          }
          else if(error instanceof Errors.AuthError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
              description: error.description,
              msg: error.message
            })
            ctx.response.status = 401,
            ctx.response.body = {
              ...rmeta,
              error: {
                code: 'unauthorized',
                message: error.message,
              }
            }
            return
          }
          else if(error instanceof Errors.CodeDescriptionError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
              description: error.description,
              msg: error.message,
            })
            ctx.response.status = 500,
            ctx.response.body = {
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            }
            return
          }
          else {
            log.error(error.stack ? {
              sid: rmeta.sid,
              msg: `service.error: ${error.message}`,
              stack: error.stack
            }: {
              sid: rmeta.sid,
              msg: `service.error: ${error.message}`
            })
            ctx.response.status = 500
            ctx.response.body = {
              ...rmeta,
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
      SlothApplication.log.debug({ msg: `registered @Controller ${url} -> ${r.route.handler.name}` })
    }
  }

  createMiddleware(middleware: Middleware): void {
    const mid = async (ctx: Context, next: Next) => {
      const m = middleware as MiddlewareCtx
      await m(() => ctx, () => next)
    }
    this.application.use(mid)
    SlothApplication.log.debug(`registered @Middleware: ${middleware.name}`)
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const port = args?.port ?? 80
    await this.application.listen({ port })
  }
}