import { ConsoleLog } from '@danielfroz/slog';
import { type Base, type Controller, Errors, type Framework, container } from "@danielfroz/sloth";
import express, { Request, Response } from 'npm:express@4.21.2';

export class ExpressFramework implements Framework<express.Application> {
  private readonly log = new ConsoleLog({ init: { mod: '@danielfroz/sloth/express' }})
  private readonly application = express()

  constructor() {
    this.application.use(express.json())
    this.application.use(express.urlencoded({ extended: true }))
  }

  app(): express.Application {
    return this.application
  }

  /**
   * Generates cotnroller using express.Router
   */
  createController(controller: Controller): void {
    const log = this.log.child({ handler: 'initController' })
    for(const r of controller.routes) {
      const router = new express.Router();
      const base = controller.base ?
        controller.base.startsWith('/') ? controller.base: `/${controller.base}`:
        ''
      const endpoint = r.route.endpoint ? 
        r.route.endpoint.startsWith('/') ? r.route.endpoint: `/${r.route.endpoint}`:
        '/'
      const url = endpoint
      router.post(url, async (preq: Request, pres: Response) => {
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }
          const req = preq.body as Base
          const res = await h.handle(req)
          return await pres.status(200).json(res)
        }
        catch(error: Error | any) {
          if(error instanceof Errors.ArgumentError) {
            log.error({ msg: `bad request; error: ${error.message}` })
            return await pres.status(400).json({
              error: {
                code: 'badrequest',
                message: error.message
              }
            })
          }
          else if(error instanceof Errors.ApiError) {
            log.error({ msg: `api error; url: ${error.url}, status: ${error.status}, error: ${error.message}` })
            return await pres.status(error.status).json({
              error: {
                code: 'api.service',
                message: error.message,
              }
            })
          }
          else if(error instanceof Errors.AuthError) {
            log.error({ msg: `auth error; unauthorized, code: ${error.code}, error: ${error.description}` })
            return await pres.status(401).json({
              error: {
                code: 'unauthorized',
                message: error.message,
              }
            })
            return
          }
          else if(error instanceof Errors.CodeDescriptionError) {
            log.error({ msg: `service error; unauthorized, code: ${error.code}, error: ${error.description}` })
            return await pres.status(500).json({
              error: {
                code: error.code,
                message: error.message,
              }
            })
            return
          }
          else {
            log.error({ msg: `service.error; ${error.message}` })
            return await pres.status(500).json({
              error: {
                code: 'service.error',
                message: `${error}`
              }
            })
          }
        }
      })

      this.application.use(base, router)
      log.debug(`registered handler ${base}${url} -> ${r.route.handler.name}`)
    }
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const port = args?.port ?? 80
    await this.application.listen({ port })
  }
}