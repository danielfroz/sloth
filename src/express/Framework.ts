import { Application, type Base, BaseResult, type Controller, Errors, type Framework, MiddlewareReq, container } from "@danielfroz/sloth";
import express, { NextFunction, Request, Response } from 'npm:express@4.21.2';
import { Middleware } from "../Middleware.ts";

const MOD = '@danielfroz/sloth/express'

export class ExpressFramework implements Framework<express.Application> {
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
        const log = Application.log.child({ handler: url })

        // this allow to catch the ID and SID from the request to pass along the error response
        const rmeta: Partial<BaseResult> = {}
        try {
          const h = container.resolve(r.type)
          if(!h) {
            throw new Error(`handler not resolved with type: ${r.type}`)
          }

          const req = preq.body as Base
          rmeta.id = req.id
          rmeta.sid = req.sid

          // If Midlleware has defined res.locals, then we pass this down to the Command or Query
          const cmdreq = pres.locals != null ? {
            ...pres.locals,
            ...req,
          }: req

          const res = await h.handle(cmdreq)
          return await pres.status(200).json({
            ...rmeta,
            ...res
          })
        }
        catch(error: Error | any) {
          if(error instanceof Errors.ArgumentError) {
            log.error({ sid: rmeta.sid, msg: `bad request error: ${error.message}` })
            return await pres.status(400).json({
              ...rmeta,
              error: {
                code: 'badrequest',
                message: error.message
              }
            })
          }
          else if(error instanceof Errors.ApiError) {
            log.error({
              sid: rmeta.sid, 
              url: error.url,
              status: error.status,
              msg: `api error: ${error.message}`,
            })
            return await pres.status(error.status).json({
              error: {
                code: 'api.service',
                message: error.message,
              }
            })
          }
          else if(error instanceof Errors.AuthError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
              description: error.description,
              msg: `auth error: ${error.message}`,
            })
            return await pres.status(401).json({
              ...rmeta,
              error: {
                code: 'unauthorized',
                message: error.message,
              }
            })
            return
          }
          else if(error instanceof Errors.CodeDescriptionError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
              description: error.description,
              msg: `error: ${error.message}`
            })
            return await pres.status(500).json({
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            })
            return
          }
          else {
            log.error({
              sid: rmeta.sid,
              msg: `service.error: ${error.message}`
            })
            return await pres.status(500).json({
              ...rmeta,
              error: {
                code: 'service.error',
                message: `${error}`
              }
            })
          }
        }
      })

      this.application.use(base, router)
      Application.log.debug({ msg: `registered handler ${base}${url} -> ${r.route.handler.name}` })
    }
  }

  createMiddleware(middleware: Middleware): void {
    const mid = async (req: Request, res: Response, next: NextFunction) => {
      const m = middleware as MiddlewareReq
      await m<Request, Response, NextFunction>(() => req, () => res, () => next)
    }
    this.application.use(mid)
    Application.log.debug(`registered @Middleware: ${middleware.name}`)
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const port = args?.port ?? 80
    await this.application.listen({ port })
  }
}