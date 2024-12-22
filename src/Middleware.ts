
export type MiddlewareReq = <RQ = any, RS = any, NT = any>(req: Middleware.ReqFn<RQ>, res: Middleware.ResFn<RS>, next: Middleware.NextFn<NT>) => Promise<void>
export type MiddlewareCtx = <CT extends any, NT extends any>(ctx: Middleware.CtxFn<CT>, next: Middleware.NextFn<NT>) => Promise<void>
export type Middleware = MiddlewareCtx | MiddlewareReq

export namespace Middleware {
  export type CtxFn<T> = () => T
  export type ReqFn<T> = () => T
  export type ResFn<T> = () => T
  export type NextFn<T> = () => T
}