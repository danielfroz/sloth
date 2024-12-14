import { Controller } from './mod.ts'

export interface Framework<T> {
  /** this returns the Framework's container; for Oak it returns the Application object */
  container(): T
  initController(controller: Controller): void
  listen(args?: Framework.Listen): Promise<void>
}

export namespace Framework {
  export interface Listen {
    port: number
  }
}