import { app } from '@/app.ts';
import express, { NextFunction, Request, Response } from "express";

export const init = async () => {
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
    const start = new Date().getTime()
    await next()
    const end = new Date().getTime()
    console.log(`request to ${req.originalUrl} served in ${end - start} ms`)
  })
}