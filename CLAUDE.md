# Sloth — Project Guide for Claude

> **Maintenance (read first):** This file is the living status doc for Sloth.
> **Keep it updated** whenever the public API, `src/mod.ts` exports, directory
> structure, `deno.json` (version/exports/imports), or core conventions change.
> Future sessions rely on it to pick up from the latest state — treat it as part
> of "done" for any change that touches those areas.

## What Sloth is

Sloth is an **opinionated CQRS API framework** that hooks **Dependency Injection
+ CQRS** onto an existing HTTP server (Deno **Oak** or Node **Express**). You
write plain handler classes implementing `handle()`; Sloth wires routing, DI
resolution, request/response mapping, middleware, and error handling.

- Package: `@danielfroz/sloth` (JSR), runtime: **Deno**, version in `deno.json`.
- License MIT. Pre-1.0 — interfaces may still change.
- Exports map (`deno.json`): `.` → `src/mod.ts`, `./oak` → `src/oak/mod.ts`,
  `./express` → `src/express/mod.ts`.

## Core abstractions (with file pointers)

- **`src/Cqrs.ts`** — contracts: `Base`/`BaseResult` (carry `id`, `sid`,
  `author?`, `error?`), `Command`/`CommandResult`, `Query`/`QueryResult`, and the
  handler interfaces `CommandHandler`, `QueryHandler`, `BaseHandler` (all just
  `handle(input): Promise<result>`).
- **`src/Controller.ts`** — `Controller(base)` + `.add({ endpoint, handler }, { scope })`.
  `.add()` registers the handler in the DI container under a generated `Type`
  token and stores a `ControllerRoute` (`{ type, route }`). Adapters iterate
  `controller.routes`.
- **`src/Route.ts`** — decorator-based discovery (the low-boilerplate path):
  - `@Route(path, { scope?, use? })` — class decorator; records the handler in a
    module-level registry as an **import-time side effect**. `use` is an optional
    array of route-scoped middlewares. Empty/whitespace path throws; a missing
    leading slash is auto-normalized.
  - `buildControllers()` — assembles `Controller`s from the registry, grouped by
    **first path segment** (`/echo/get` → base `/echo`, endpoint `/get`), passing
    `middlewares` through to the route descriptor.
  - `clearRoutes()` — empties the registry (tests / rebuild guard).
- **`src/Application.ts`** — `Application` (holds the `Framework`, ordered
  `#handlers`), `HandlerBuilder` via `app.Handlers`:
  - `.push()/.add()` — append a `Controller` or `Middleware` (order preserved).
  - `.routes()` — push all `@Route`-discovered controllers at this position.
  - `.pipeline({ before?, controllers?, after?, discover? })` — structured global
    pipeline: pushes `before` middlewares → manual `controllers` → discovered
    `@Route` controllers (unless `discover:false`) → `after` middlewares. Sugar
    over push()/routes(). `Pipeline` interface is exported.
  - `app.Providers` (`ProviderBuilder`) — `.discover()` registers every
    `@Provide`/`@Repository`/`@Service`-decorated class. (Replaces the old
    `ServiceBuilder`.) For decorator-free/one-off bindings use `container.register`.
  - `app.Inits` (`InitRunner`) — `await app.Inits.run(...InitClasses)` resolves each
    `Initializer` through the container (constructor DI works) and `await`s `init()`
    **in order**; a throwing init aborts. For the ordered I/O bootstrap.
  - `app.warmup()` and `app.start({ port, hostname, callback, warmup? })` — `start`
    wires handlers and listens; it runs `warmup()` **by default** (opt out with
    `{ warmup: false }`).
- **`src/Framework.ts`** + **`src/oak/Framework.ts`**, **`src/express/Framework.ts`**
  — adapter interface (`createController`, `createMiddleware`, `listen`). The
  adapter resolves the handler from DI, parses the body (json / urlencoded /
  multipart), merges middleware state (`ctx.state` on Oak, `res.locals` on
  Express) into the command/query, calls `handle()`, maps errors to HTTP status.
  Each adapter has a private `wrap()` that adapts a Sloth `Middleware` to the
  framework signature, reused by `createMiddleware` (global) and per-route
  middleware (spread into `router.post` before the handler). **Express adapter is
  on Express 5** (`npm:express@5.2.1`, `npm:multer@2.2.0`).
- **`src/Middleware.ts`** — `Middleware` (ctx-style for Oak, req/res-style for
  Express); set state to pass data into handlers (e.g. `ctx.state.auth = token`).
  Apply globally via `app.Handlers.pipeline({ before, after })` or scope to one
  route via `@Route(path, { use: [...] })` / `Controller.add({ ..., middlewares })`.
- **`src/di/`** — a small DI container (originally a di-wise fork, since slimmed
  to the surface Sloth actually uses; 7 files). Exposed via `import { DI } from
  '@danielfroz/sloth'`: `inject(token)`, `Scope` (`Singleton` | `Transient`),
  `Type<T>(name)` tokens, `container`, `createContainer`, and the
  `Provider`/`Constructor`/`Token` types. `container` singleton lives in
  `src/Container.ts`. The container is `register(token, provider, options?)` /
  `resolve(token)` / `inject(token)` / `has(token)` / `warmup()`; one registration
  per token (no multi-provider/`resolveAll`), synchronous resolution with an ambient
  current-container + a `Set` for circular detection. **Default scope is
  `Singleton`** when `register` omits `{ scope }`. Use `{ scope: DI.Scope.Transient }`
  for the rare dep that must be a fresh instance per resolve.
  - **`inject` is lazy by default** (`src/di/inject.ts` + `container.inject`):
    a **class** dependency (or an unregistered `Constructor`) is returned as a
    transparent proxy (`src/di/proxy.ts`) constructed on first use — so circular
    dependencies and registration order never matter, with **no annotation**. A
    **value/factory** dependency is resolved eagerly and returned directly (so
    primitives — secret strings, URIs — work; proxies can't wrap primitives). An
    unregistered **`Type`** token throws at inject time. There is **no separate
    `lazy`** — `inject` is the lazy one. `container.resolve` stays eager (used by
    `warmup`, `Inits`, per-request handler resolution); an unregistered
    `Constructor` resolves as Transient (di-wise behavior — many services resolve
    handler classes this way).
  - **`warmup`** (`container.warmup()` / `app.warmup()`) — eagerly resolves every
    registered class/factory token once; runs in `start()` **by default** (opt out
    `{ warmup: false }`). Because lazy `inject` does an eager *lookup*, missing
    wiring (unregistered token) still fails here at **boot**. Singletons
    constructed+cached, transients validated+discarded, values skipped; failures
    aggregate into one `Errors.InitError`.
  - Residual cost of lazy-by-default: object deps are proxies → tiny per-access
    overhead (bound methods cached) and `dep instanceof Class` is `false`. Values
    unaffected.
  - **Removed in 0.3.0** (unused by every service and the framework): the
    `@Injectable`/`@Scoped`/`@AutoRegister`/`@Inject`/`@InjectAll` decorators,
    `injectAll`/`injectBy`/`Injector`, `resolveAll`, multi-token `inject(a, b, …)`,
    child/parent containers, container middleware, `Build`/`Value` builder tokens,
    `autoRegister`, `Type.inter`/`union`, and the standalone `lazy`.
- **`src/Provide.ts`** — `@Provide(token, { scope? })` + `@Repository`/`@Service`
  aliases (mirrors `Route.ts`): records `(token, ctor, scope)` in a module-level
  registry at import time; `registerProviders(c?)` registers them (via
  `app.Providers.discover()`), `clearProviders()` for tests. Import the provider
  barrel (side-effect) before discovery so the decorators have run.
- **`src/Initializer.ts`** — `Initializer { init(): Promise<void> | void }`; the
  unit of ordered imperative bootstrap, run via `app.Inits.run(...)`.
- **`src/Errors.ts`** (exported as `Errors` namespace) — `ArgumentError(msg)`,
  `InitError(msg)`, `AuthError(code, message)`, `CodeError(code, msg)`,
  `ApiError(method, url, status, code, message)`. **`AuthError` takes 2 args**
  (a 3-arg `description` form was deprecated/removed).
- **`src/Api.ts`** — outbound HTTP API client helper.

## Two ways to define endpoints

1. **Decorator discovery (preferred, low boilerplate)** — `@Route` on the
   handler + `app.Handlers.routes()`/`pipeline({ discover: true })`. Reference:
   **both `examples/oak` and `examples/express`** (same shape on each adapter).
   ⚠️ Handler modules must be imported (side-effect import of the handlers
   barrel) before discovery so the decorators have run.
2. **Manual** — `new Controller(base).add(...)` then `app.Handlers.push(controller)`
   or `pipeline({ controllers: [...], discover: false })`. Fully supported, no
   longer used by the bundled examples; shown as a snippet in the README.

Both are fully supported and can coexist.

For upgrading an existing service, see `MIGRATION.md` (0.1.x → 0.2.0). LLM-driven
migration/scaffolding is encoded in `.claude/skills/sloth-migrate` and
`.claude/skills/sloth-scaffold`; keep them in sync with `MIGRATION.md` and the
README when the public API changes.

## Layout

```
src/
  mod.ts            # public barrel — all exports gated here
  Application.ts Controller.ts Route.ts Cqrs.ts Framework.ts Middleware.ts
  Provide.ts Initializer.ts Errors.ts Api.ts Container.ts
  di/               # small DI container (slimmed di-wise fork; incl. proxy.ts for lazy inject)
  oak/  express/    # framework adapters (own mod.ts each)
test/               # framework unit tests (deno test)
examples/
  oak/              # @Route discovery + pipeline reference (Oak) + smoke test
  express/          # @Route discovery + pipeline reference (Express 5) — same shape as oak
MIGRATION.md        # upgrade guides (0.1.x → 0.2.0, 0.2.0 → 0.3.0), ships with package
releases/           # per-release notes (one MD per tag) mirroring GitHub releases + index
.claude/skills/     # community skills: sloth-migrate, sloth-scaffold (excluded from JSR publish)
```

Example layout (`examples/*/src/`): `main.ts` (full bootstrap — `Providers.discover()`
+ `Inits.run()` + `pipeline()` + `start()`), `types.ts` (DI `Type` tokens),
`handlers/cqrs/<domain>/` (`@Route`), `models/`, `repositories/mem/` (`@Repository`),
`services/` (`@Service` — `GithubService` calls the GitHub API via `ApiFetch` and
maps the response into a Result), `middlewares/`, `inits/` (`LogInit`, `ApiInit`
`Initializer`s). Both `examples/oak` and `examples/express` carry the same set.

## Commands

```sh
sh ./compile.sh          # deno compile of mod / express / oak (type-check)
sh ./test.sh             # deno test ./test (framework unit tests)
deno publish --dry-run --allow-dirty   # REQUIRED before pushing — runs JSR's
                                       # slow-types + publish validation (the
                                       # workflow publishes on every push to main)
cd examples/oak && sh ./dev.sh    # run example (deno run -A --watch)
cd examples/oak && sh ./test.sh   # example tests
```

Quick example type-check: `cd examples/oak && deno check src/main.ts`.

## Conventions

- Handlers: one class per file, named `*Handler.ts` (`EchoGetHandler`,
  `EchoSaveHandler`); validate inputs first with `Errors.ArgumentError('x')`;
  return `{ id, sid, ... }`.
- **Handlers must be stateless.** Default scope is `Singleton` (one instance per
  app, resolved per request), so per-request data must live in the `cmd`/`query`
  arg and `handle()` locals — never on instance fields (only injected deps belong
  there). Single-threaded ≠ safe: the event loop interleaves requests at every
  `await`, so per-request state on `this` leaks across concurrent requests.
  `Transient` is an escape hatch for the rare stateful handler; staying stateless
  is preferred. (See README "Handler Scope" section.)
- Use `Errors.CodeError` / `Errors.ArgumentError` / `Errors.AuthError(code, msg)`.
- All new public surface must be re-exported from `src/mod.ts`.
- **Exported (public-API) functions need an explicit return type** — JSR's
  `publish` slow-types check rejects inferred returns (this broke 0.3.0 via
  `Provide()` returning a decorator). Verify with `deno publish --dry-run`.
- Lint (`deno.json`): `no-namespace`, `no-explicit-any`.
- Constructor DI via default params: `constructor(private repo = DI.inject(Types.Repos.X)) {}`.
