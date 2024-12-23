import { ConsoleLog, Log } from "@danielfroz/slog";
import { container } from "./Container.ts";
import { Controller } from './Controller.ts';
import { type Framework } from "./Framework.ts";
import { DI, Errors, Middleware } from "./mod.ts";

export interface ApplicationConstructorProps<C = any> {
  framework: Framework<C>
  log?: Log
}

export class HandlerBuilder {
  constructor(readonly handlers: Array<Controller | Middleware>) {}

  add(handler: Controller | Middleware): HandlerBuilder {
    return this.push(handler)
  }

  push(handler: Controller | Middleware): HandlerBuilder {
    this.handlers.push(handler)
    return this
  }
}

export class ServiceBuilder {
  /**
   * Injects the class to the DI container; class resolution depends on the Scope.
   */
  addClass<T extends object>(token: DI.Token<T>, clazz: DI.Constructor<T>, options?: { scope?: DI.Scope }): ServiceBuilder {
    if(!token)
      throw new Errors.ArgumentError('token')
    if(!clazz)
      throw new Errors.ArgumentError('clazz')
    container.register<T>(token, { useClass: clazz }, {
      scope: options?.scope ?? DI.Scope.Singleton
    })
    return this
  }

  /**
   * Injects the object to the DI container
   * Note that the value is always registered as Singleton
   */
  addValue<T extends object>(token: DI.Token<T>, value: T): ServiceBuilder {
    if(!token)
      throw new Errors.ArgumentError('token')
    if(!value)
      throw new Errors.ArgumentError('value')
    container.register<T>(token, { useValue: value })
    return this
  }
}

export class Application {
  static log: Log
  readonly framework: Framework<any>
  readonly #handlers = new Array<Controller | Middleware>()

  constructor(
    props: ApplicationConstructorProps<any>
  ) {
    this.framework = props.framework
    /** 
     * { sloth: true }, indicates that the log entries are reported by 
     * Sloth Application and/or Framework; so may differ from your services's log.
     * It may seems a cosmetic but helps when DEBUG or TRACE level are set
     */
    Application.log = props.log ?
      props.log.child({ sloth: true }):
      new ConsoleLog({ init: { mod: '@danielfroz/sloth' }})
  }

  get app(): any {
    return this.framework.app()
  }

  get Handlers(): HandlerBuilder {
    return new HandlerBuilder(this.#handlers)
  }

  get Services(): ServiceBuilder {
    return new ServiceBuilder()
  }

  async start(args: { port: number }): Promise<void> {
    // leaving the initialization of the controllers to the last moment...
    for(const c of this.#handlers) {
      if(typeof(c) === 'function')
        this.framework.createMiddleware(c as Middleware)
      else
        this.framework.createController(c as Controller)
    }
    const port = args?.port ?? 80
    await this.framework.listen({ port })
  }
}