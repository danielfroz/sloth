import {
  Application,
  type Base,
  BaseResult,
  type Controller,
  Errors,
  type Framework,
  Middleware,
  MiddlewareCtx,
  container
} from "@danielfroz/sloth";
import { Application as OakApplication, Context, Next, Router } from "jsr:@oak/oak@17.2.0";

export class OakFramework implements Framework<OakApplication> {
  private readonly application = new OakApplication()

  app(): OakApplication {
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
        const log = Application.log.child({ handler: url })

        // this allow to catch the ID and SID from the request to pass along the error response
        const rmeta: Partial<BaseResult> = {}
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }

          const contentType = ctx.request.headers.get('content-type') ?? ''
          let req: Base
          if(contentType.includes('multipart/form-data')) {
            const formData = await ctx.request.body.formData()
            const obj: Record<string, unknown> = {}
            for(const [key, value] of formData.entries()) {
              if(value instanceof File) {
                const buffer = await value.arrayBuffer()
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
                obj[key] = {
                  name: value.name,
                  type: value.type,
                  content: base64
                }
              }
              else {
                obj[key] = value
              }
            }
            req = obj as unknown as Base
          }
          else if(contentType.includes('application/x-www-form-urlencoded')) {
            const form = await ctx.request.body.form()
            req = Object.fromEntries(form.entries()) as unknown as Base
          }
          else {
            req = await ctx.request.body.json() as Base
          }
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
            log.error(error.stack ? {
              sid: rmeta.sid,
              msg: 'bad request',
              arg: error.message,
              stack: error.stack
            }: {
              sid: rmeta.sid,
              msg: 'bad request',
              arg: error.message
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
            log.error({ sid: rmeta.sid, code: error.code, msg: error.message })
            ctx.response.status = 401,
            ctx.response.body = {
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            }
            return
          }
          else if(error instanceof Errors.CodeError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
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
          }
          else {
            log.error(error.stack ? {
              sid: rmeta.sid,
              msg: error.message,
              stack: error.stack
            }: {
              sid: rmeta.sid,
              msg: error.message,
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
      Application.log.debug({ msg: `registered @Controller ${url} -> ${r.route.handler.name}` })
    }
  }

  createMiddleware(middleware: Middleware): void {
    const mid = async (ctx: Context, next: Next) => {
      const m = middleware as MiddlewareCtx
      await m(() => ctx, () => next)
    }
    this.application.use(mid)
    Application.log.debug(`registered @Middleware: ${middleware.name}`)
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const hostname = args?.hostname ?? '0.0.0.0'
    const port = args?.port ?? 80
    const cb = args?.callback
    this.application.addEventListener('listen', () => {
      if(cb) {
        cb({ hostname, port })
      }
    })
    await this.application.listen({ hostname, port })
  }
}