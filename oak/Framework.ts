import { Log } from '@danielfroz/slog';
import { type Base, type Controller, Errors, type Framework, container } from "@danielfroz/slothcore";
import { Application, type Context, Router } from "@oak/oak";

export class OakFramework implements Framework<Application> {
  private readonly log = new Log({ prefix: { mod: '@danielfroz/sloth/oak' }})
  private readonly application = new Application()

  container() {
    return this.application
  }

  initController(controller: Controller): void {
    const log = this.log.child({ handler: 'initController' })
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
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }
          const req = await ctx.request.body.json() as Base
          const res = await h.handle(req)
          ctx.response.status = 200
          ctx.response.body = res
          return
        }
        catch(error: Error | any) {
          if(error instanceof Errors.ArgumentError) {
            ctx.response.status = 400
            ctx.response.body = {
              error: {
                code: 'badrequest',
                message: error.message
              }
            }
            return
          }
          else {
            ctx.response.status = 500
            ctx.response.body = {
              error: {
                code: 'service.error',
                message: `${error.message ?? ''}`
              }
            }
            return
          }
        }
      })

      this.application.use(router.routes())

      log.debug(`registered handler ${url} -> ${r.route.handler.name}`)
    }
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const port = args?.port ?? 80
    await this.application.listen({ port })
  }
}