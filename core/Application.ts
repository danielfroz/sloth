import { container } from "./Container.ts";
import { Controller } from './Controller.ts';
import { type Framework } from "./Framework.ts";
import { DI } from "./mod.ts";

export interface ApplicationConstructorProps<C = any> {
  framework: Framework<C>
}

export class ControllerBuilder {
  constructor(readonly controllers: Array<Controller>) {}

  add(controller: Controller) {
    return this.push(controller)
  }

  push(controller: Controller) {
    this.controllers.push(controller)
    return this
  }
}

export class ServiceBuilder {
  /**
   * Injects the class to the DI container; class resolution depends on the Scope.
   */
  addClass<T extends object>(token: DI.Token<T>, clazz: DI.Constructor<T>, options?: { scope?: DI.Scope }): ServiceBuilder {
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
    container.register<T>(token, { useValue: value })
    return this
  }
}

export class Application {
  readonly framework: Framework<any>
  readonly #controllers = new Array<Controller>()

  constructor(
    props: ApplicationConstructorProps<any>
  ) {
    this.framework = props.framework
  }

  get app(): any {
    return this.framework.app()
  }

  get Controllers(): ControllerBuilder {
    return new ControllerBuilder(this.#controllers)
  }
  
  get Services(): ServiceBuilder {
    return new ServiceBuilder()
  }

  async start(args: { port: number }): Promise<void> {
    // leaving the initialization of the controllers to the last moment...
    for(const c of this.#controllers) {
      this.framework.createController(c)
    }
    const port = args?.port ?? 80
    await this.framework.listen({ port })
  }
}