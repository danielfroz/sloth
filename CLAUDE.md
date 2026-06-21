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
  - `app.start({ port, hostname, callback })` — wires handlers into the framework
    and listens. `ServiceBuilder` (`addClass`/`addValue`) exists but the
    `app.Services` getter is currently commented out.
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
- **`src/di/`** — DI container (fork of di-wise, TC39 standard decorators).
  Exposed via `import { DI } from '@danielfroz/sloth'`: `inject`, `injectAll`,
  `injectBy`, `@Injectable`, `@Scoped`, `@AutoRegister`, `@Inject`, `@InjectAll`,
  `Scope` (`Singleton` | `Transient`), `Type<T>(name)` tokens, `container`,
  `createContainer`. Metadata is a `WeakMap` (`src/di/metadata.ts`), not
  `Reflect`. `container` singleton lives in `src/Container.ts`.
- **`src/Errors.ts`** (exported as `Errors` namespace) — `ArgumentError(msg)`,
  `InitError(msg)`, `AuthError(code, message)`, `CodeError(code, msg)`,
  `ApiError(method, url, status, code, message)`. **`AuthError` takes 2 args**
  (a 3-arg `description` form was deprecated/removed).
- **`src/Api.ts`** — outbound HTTP API client helper.

## Two ways to define endpoints

1. **Decorator discovery (preferred, low boilerplate)** — `@Route` on the
   handler + `app.Handlers.routes()`. Reference: **`examples/oak`**.
   ⚠️ Handler modules must be imported (side-effect import of the handlers
   barrel) before `.routes()` so the decorators have run.
2. **Manual** — `new Controller(base).add(...)` then `app.Handlers.push(controller)`.
   Reference: **`examples/express`**.

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
  Errors.ts Api.ts Container.ts
  di/               # DI container + decorators (di-wise fork)
  oak/  express/    # framework adapters (own mod.ts each)
test/               # framework unit tests (deno test)
examples/
  oak/              # decorator-style (@Route + pipeline) reference + smoke test
  express/          # manual Controller.add() + pipeline reference (Express 5)
MIGRATION.md        # 0.1.x → 0.2.0 upgrade guide (canonical, ships with package)
.claude/skills/     # community skills: sloth-migrate, sloth-scaffold (excluded from JSR publish)
```

Example layout (`examples/*/src/`): `main.ts` (bootstrap order), `app.ts`,
`types.ts` (DI `Type` tokens), `handlers/cqrs/<domain>/`, `models/`,
`repositories/`, `middlewares/`, `inits/` (Log, Repos, framework, Handlers).

## Commands

```sh
sh ./compile.sh          # deno compile of mod / express / oak (type-check)
sh ./test.sh             # deno test ./test (framework unit tests)
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
- Lint (`deno.json`): `no-namespace`, `no-explicit-any`.
- Constructor DI via default params: `constructor(private repo = DI.inject(Types.Repos.X)) {}`.
