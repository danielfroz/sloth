// deno-lint-ignore-file no-explicit-any no-namespace
export type MiddlewareReq<RQ=any, RS=any, NT=any> = (req: Middleware.ReqFn<RQ>, res: Middleware.ResFn<RS>, next: Middleware.NextFn<NT>) => Promise<void>
export type MiddlewareCtx<CT=any, NT=any> = (req: Middleware.CtxFn<CT>, next: Middleware.NextFn<NT>) => Promise<void>
export type Middleware<CT=any, RQ=any, RS=any, NT=any> =
  | ((req: Middleware.ReqFn<RQ>, res: Middleware.ResFn<RS>, next: Middleware.NextFn<NT>) => Promise<void>)
  | ((ctx: Middleware.CtxFn<CT>, next: Middleware.NextFn<NT>) => Promise<void>)

export namespace Middleware {
  export type CtxFn<T> = () => T
  export type ReqFn<T> = () => T
  export type ResFn<T> = () => T
  export type NextFn<T> = () => T
}