import { EchoController } from "@/controllers/index.ts";
import { AuthMiddleware, NotFoundMiddleware } from "@/middlewares/index.ts";
import { Types } from "@/types.ts";
import { Application, container } from "@danielfroz/sloth";
import { ExpressFramework } from "@danielfroz/sloth/express";
import express, { NextFunction, Request, Response } from "express";

/**
 * This code initializes the Application injecting all Handlers
 * You may do not want to use this approach as it forces you to know container()
 * closer. Check the examples/oak source code to understand the other way to
 * initialize the service
 */
export const init = async () => {
  const log = container.resolve(Types.Log)
  const app = new Application({
    framework: new ExpressFramework(),
    log
  })

  /**
   * This code injects the Controllers & Middlewares to the DI for later initialization
   * Note that initialization only happens at .start() phase
   */
  app.Handlers.add(AuthMiddleware)
  app.Handlers.add(EchoController)
  app.Handlers.add(NotFoundMiddleware)

  /**
   * Accessing the framework Container
   * In this example we're accessing the Oak server application.
   * note that casting is necessary as container() can be anything; depends really on Framework's implementation
   */
  const eapp = app.app as express
  
  /**
   * Example of middleware created directly from Oak/oak
   * 
   * This allow us to extend the implementation as needed...
   * Even create Routers manually
   */
  eapp.use(async (req: Request, _res: Response, next: NextFunction) => {
    const log = container.resolve(Types.Log).child({ handler: 'express.perf' })
    const start = new Date().getTime()
    await next()
    const end = new Date().getTime()
    log.info({ msg: `request to ${req.originalUrl} served in ${end - start} ms` })
  })

  const port = 4000
  log.info({ msg: `starting application on port: ${port}`})
  await app.start({ port })
}