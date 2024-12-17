import { Controller } from './mod.ts'

export interface Framework<T = any> {
  /** this returns the Framework's app container; for Oak it returns the Application object */
  app(): T
  createController(controller: Controller): void
  listen(args?: Framework.Listen): Promise<void>
}

export namespace Framework {
  export interface Listen {
    port: number
  }
}