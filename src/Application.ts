import { JsonLog, Log } from "@danielfroz/slog";
import { container } from "./Container.ts";
import { Controller } from './Controller.ts';
import { type Framework } from "./Framework.ts";
import { Initializer } from "./Initializer.ts";
import { DI, Errors, Middleware } from "./mod.ts";
import { registerProviders } from "./Provide.ts";
import { buildControllers } from "./Route.ts";

export interface ApplicationConstructorProps<C = any> {
  framework: Framework<C>
  log?: Log
}

/**
 * Structured global pipeline declaration. Middlewares run in array order:
 * `before` → controllers → `after`. Controllers come from `controllers` (manual)
 * plus, unless `discover` is false, every `@Route`-decorated handler.
 */
export interface Pipeline {
  /** Middlewares that run before every controller (auth, cors, request logging). */
  before?: Middleware[]
  /** Manual controllers to mount (in addition to `@Route`-discovered ones). */
  controllers?: Controller[]
  /** Middlewares that run after all controllers (404 catch-all, fallback). */
  after?: Middleware[]
  /** Include `@Route`-discovered controllers between `before` and `after`. Default: true. */
  discover?: boolean
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

  /**
   * Pushes the Controllers assembled from every `@Route`-decorated handler into
   * the handler chain at this exact position. Call it between middlewares to
   * preserve ordering, e.g.:
   *
   * ```ts
   * app.Handlers
   *   .push(AuthMiddleware)     // runs before controllers
   *   .routes()                 // all @Route controllers inserted here
   *   .push(NotFoundMiddleware) // catch-all, last
   * ```
   *
   * IMPORTANT: handler modules must be imported before calling this (e.g. a
   * side-effect import of the handlers barrel) so their decorators have run.
   */
  routes(): HandlerBuilder {
    for(const controller of buildControllers())
      this.handlers.push(controller)
    return this
  }

  /**
   * Declares the whole request pipeline in one structured call, in order:
   * `before` middlewares → controllers (manual + `@Route`-discovered) → `after`
   * middlewares. Sugar over push()/routes() that makes the
   * before/after-controllers split explicit.
   *
   * ```ts
   * app.Handlers.pipeline({
   *   before: [LogMiddleware],      // runs before all controllers
   *   after:  [NotFoundMiddleware], // catch-all, runs last
   * })
   * ```
   *
   * IMPORTANT: when relying on `@Route` discovery (the default), import your
   * handler modules first (side-effect import of the handlers barrel) so their
   * decorators have run.
   */
  pipeline(p: Pipeline): HandlerBuilder {
    for(const m of p.before ?? [])
      this.handlers.push(m)
    for(const c of p.controllers ?? [])
      this.handlers.push(c)
    if(p.discover !== false)
      for(const c of buildControllers())
        this.handlers.push(c)
    for(const m of p.after ?? [])
      this.handlers.push(m)
    return this
  }
}

/**
 * Registers DI providers — every `@Provide`/`@Repository`/`@Service`-decorated
 * class. Registration order is irrelevant (`inject` is lazy; `warmup` validates
 * at boot). For decorator-free or one-off bindings, use `container.register(...)`
 * directly.
 */
export class ProviderBuilder {
  /**
   * Registers every `@Provide`/`@Repository`/`@Service`-decorated class.
   *
   * IMPORTANT: the decorated modules must be imported first (a side-effect import
   * of the providers barrel) so their decorators have run.
   */
  discover(): ProviderBuilder {
    registerProviders(container)
    return this
  }
}

/**
 * Runs {@link Initializer}s — the ordered, imperative I/O bootstrap (connect
 * Mongo, load secrets, build API clients, init the event bus, …).
 */
export class InitRunner {
  /**
   * Resolves each initializer through the container (so constructor DI works) and
   * awaits its `init()` **in argument order**. A throwing initializer aborts the
   * run (and therefore startup).
   */
  async run(...inits: DI.Constructor<Initializer>[]): Promise<void> {
    for(const Init of inits) {
      if(!Init)
        throw new Errors.ArgumentError('init')
      const initializer = container.resolve(Init)
      await initializer.init()
    }
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
      new JsonLog({ init: { mod: '@danielfroz/sloth' }})
  }

  get app(): any {
    return this.framework.app()
  }

  get Handlers(): HandlerBuilder {
    return new HandlerBuilder(this.#handlers)
  }

  /**
   * DI provider registration — `app.Providers.discover()` registers every
   * `@Provide`/`@Repository`/`@Service` class.
   */
  get Providers(): ProviderBuilder {
    return new ProviderBuilder()
  }

  /**
   * Ordered, imperative bootstrap — `await app.Inits.run(LogInit, SecretInit, …)`.
   */
  get Inits(): InitRunner {
    return new InitRunner()
  }

  /**
   * Eagerly resolves every registered class/factory token once, so a missing or
   * misconfigured dependency fails at boot instead of on the first request that
   * touches it. Singletons are constructed and cached; transients are validated
   * and discarded.
   *
   * Because `inject` is lazy, constructing a class resolves its class
   * dependencies as proxies — but warmup constructs every *registered* class, and
   * `inject`'s eager registration lookup throws on an unregistered token, so
   * missing wiring still surfaces here at boot.
   *
   * Called automatically by {@link Application.start} unless `{ warmup: false }`
   * is passed; can also be invoked manually after all registrations are in place.
   */
  warmup(): { resolved: number } {
    const result = container.warmup()
    Application.log.debug({ msg: 'container warmup complete', resolved: result.resolved })
    return result
  }

  async start(args: Framework.Listen & { warmup?: boolean }): Promise<void> {
    if(this.#handlers.length === 0) {
      throw new Errors.InitError('There is no handler registered! You must add Controllers or Middlewares prior to call start()')
    }

    // leaving the initialization of the controllers to the last moment...
    for(const c of this.#handlers) {
      if(typeof(c) === 'function')
        this.framework.createMiddleware(c as Middleware)
      else
        this.framework.createController(c as Controller)
    }
    // validate/pre-build the dependency graph before listening (fail fast).
    // On by default; pass `{ warmup: false }` to skip.
    if(args?.warmup !== false)
      this.warmup()
    const port = args?.port ?? 80
    const hostname = args?.hostname ?? '0.0.0.0'
    const callback = args?.callback
    await this.framework.listen({ port, hostname, callback })
  }
}