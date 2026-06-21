import { Types } from "@/types.ts";
import { container, Middleware } from "@danielfroz/sloth";
import { NextFunction, Request, Response } from "express";

/**
 * A cross-cutting request logger used as a GLOBAL `before` middleware in the
 * pipeline — it runs ahead of every controller, times the request, and logs it.
 *
 * This is the canonical use of a global middleware (applies to all requests).
 */
export const LogMiddleware = async (reqfn: Middleware.ReqFn<Request>, _resfn: Middleware.ResFn<Response>, nextfn: Middleware.NextFn<NextFunction>): Promise<void> => {
  const req = reqfn()
  const next = nextfn()
  const log = container.resolve(Types.Log)

  const start = new Date().getTime()
  await next()
  const end = new Date().getTime()
  const elapsed = end - start

  log.info({ msg: 'request stats', endpoint: req.originalUrl, elapsed: `${elapsed} ms` })
}
