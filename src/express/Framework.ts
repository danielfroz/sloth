import {
  Application,
  type Base,
  BaseResult,
  type Controller,
  Errors,
  type Framework,
  Middleware,
  MiddlewareReq,
  container
} from "@danielfroz/sloth";
import express, { NextFunction, Request, Response } from 'npm:express@4.21.2';
import multer from 'npm:multer@2.0.2';

export class ExpressFramework implements Framework<express.Application> {
  private readonly application = express()

  private readonly upload = multer()

  constructor() {
    this.application.use(express.json())
    this.application.use(express.urlencoded({ extended: true }))
    this.application.use(this.upload.any())
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

          const obj: Record<string, unknown> = { ...preq.body }
          const files = preq.files as multer.File[] | undefined
          if(files && files.length > 0) {
            for(const file of files) {
              const base64 = file.buffer.toString('base64')
              obj[file.fieldname] = {
                name: file.originalname,
                type: file.mimetype,
                content: base64
              }
            }
          }
          const req = obj as unknown as Base
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
              code: error.code,
              msg: error.message,
            })
            return await pres.status(error.status).json({
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            })
          }
          else if(error instanceof Errors.AuthError) {
            log.error(error.description ? {
              sid: rmeta.sid,
              code: error.code,
              msg: error.message,
              description: error.description
            }: {
              sid: rmeta.sid,
              code: error.code,
              msg: error.message
            })
            return await pres.status(401).json({
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            })
          }
          else if(error instanceof Errors.CodeError) {
            log.error({
              sid: rmeta.sid,
              code: error.code,
              msg: error.message,
            })
            return await pres.status(500).json({
              ...rmeta,
              error: {
                code: error.code,
                message: error.message,
              }
            })
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
      await m(() => req, () => res, () => next)
    }
    this.application.use(mid)
    Application.log.debug(`registered @Middleware: ${middleware.name}`)
  }

  async listen(args?: Framework.Listen): Promise<void> {
    const hostname = args?.hostname ?? '0.0.0.0'
    const port = args?.port ?? 80
    const cb = args?.callback
    await this.application.listen(port, hostname, () => {
      if(cb) {
        cb({ hostname, port })
      }
    })
  }
}