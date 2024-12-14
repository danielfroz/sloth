import { Constructor, Scope, Token } from "@exuanbo/di-wise";
import { container } from "./Container.ts";
import { Controller } from './Controller.ts';
import { type Framework } from "./Framework.ts";

export interface ApplicationConstructorProps<C extends any> {
  framework: Framework<any>
}

export class Application {
  readonly framework: Framework<any>
  readonly #controllers = new Array<Controller>()

  constructor(
    props: ApplicationConstructorProps<any>
  ) {
    this.framework = props.framework
  }

  container() {
    return this.framework.container()
  }

  addController(ctrl: Controller) {
    this.#controllers.push(ctrl)
    return this;
  }

  injectClass<T extends object>(token: Token<T>, clazz: Constructor<T>) {
    container.register<T>(token, { useClass: clazz }, {
      scope: Scope.Transient
    })
    return this;
  }

  injectValue<T extends object>(token: Token<T>, value: T) {
    container.register<T>(token, { useValue: value })
  }

  async start(args: { port: number }): Promise<void> {
    // leaving the initialization of the controllers to the last moment...
    for(const c of this.#controllers) {
      this.framework.initController(c)
    }
    const port = args?.port ?? 80
    await this.framework.listen({ port })
  }
}