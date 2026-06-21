# Sloth: CQRS Opinionated API Framework

## Introduction

**Sloth** is an opinionated framework designed to simplify the development of
API services. Built on top of popular JavaScript and Deno web frameworks, it
provides a structured and scalable approach to API design.

Inspired by years of hands-on experience building APIs across various
programming languages, **Sloth** empowers developers to focus on functionality
while adhering to the CQRS (Command Query Responsibility Segregation) pattern.

## Getting Started

Ready to dive in? Explore the example implementations to see **Sloth** in
action:

- **[Oak Example](https://github.com/danielfroz/sloth/tree/main/examples/oak)**: API service implementation with Oak.
- **[Express Example](https://github.com/danielfroz/sloth/tree/main/examples/express)**: API service implementation with
  Express.

Each example showcases the recommended project structure and key concepts for
working with **Sloth**.

## Handlers

A **handler** is where your business logic lives. Following CQRS, every request
is either a **Command** (a write) or a **Query** (a read), and a handler
implements a single async method:

```ts
interface CommandHandler<C extends Command, CR extends CommandResult> { handle(command: C): Promise<CR> }
interface QueryHandler<Q extends Query, QR extends QueryResult>       { handle(query: Q): Promise<QR> }
```

### 1. Define the Command/Query and its Result

Inputs extend `Command`/`Query` and results extend `CommandResult`/`QueryResult`.
The base types carry the request envelope — `id`, `sid` (session/correlation id)
and optional `author` — so you only add your own fields:

```ts
import { Command, CommandResult } from "@danielfroz/sloth";

export interface EchoSaveCommand extends Command {        // adds: id, sid, author?
  text: string
}
export interface EchoSaveCommandResult extends CommandResult {
  echo?: Echo
}
```

### 2. Write the handler

Dependencies are injected through the constructor with default parameters
(`DI.inject(token)`); validate inputs, run logic, return the result:

```ts
import { CommandHandler, DI, Errors } from "@danielfroz/sloth";
import { Types } from "@/types.ts";

export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly repo = DI.inject(Types.Repos.Echo),   // resolved from the DI container
  ) {}

  async handle(cmd: EchoSaveCommand): Promise<EchoSaveCommandResult> {
    if(!cmd.id)   throw new Errors.ArgumentError('cmd.id')
    if(!cmd.text) throw new Errors.ArgumentError('cmd.text')

    const echo = { id: cmd.id, text: cmd.text }
    await this.repo.save(echo)

    return { id: cmd.id, sid: cmd.sid, echo }
  }
}
```

Because the handler is a plain class, it's trivial to unit test — just `new` it
with a stubbed dependency and call `handle()` (see the examples' `test/`).

### 3. Request / response contract

Each handler is exposed as an HTTP **POST**. The adapter does the wiring for you:

- The JSON body is parsed and **merged with any middleware state** (`ctx.state`
  on Oak, `res.locals` on Express) to form the `cmd`/`query` argument — that's how
  a middleware passes data down (e.g. `ctx.state.auth = token` → `cmd.auth`).
- The object you **return becomes the JSON response** (with `id`/`sid` echoed).
- **Thrown errors map to HTTP status**: `Errors.ArgumentError` → 400,
  `Errors.AuthError` → 401, `Errors.CodeError` → 422, `Errors.ApiError` → its
  status, anything else → 500 — each as `{ id, sid, error: { code, message } }`.

Once a handler exists, you expose it by mapping it to a route ↓

## Defining endpoints

Sloth offers two ways to map an HTTP endpoint to a CQRS handler. Both produce the
same controllers and run through the same request pipeline (DI resolution, body
parsing, middleware state merge, error mapping) — pick whichever fits.

### 1. Decorator-based discovery (recommended)

Declare the route **on the handler** with `@Route` and let the application
assemble the controllers automatically. No `controllers/*.ts` files to maintain —
adding an endpoint is just a new handler. See **[examples/oak](https://github.com/danielfroz/sloth/tree/main/examples/oak)**.

```ts
import { CommandHandler, DI, QueryHandler, Route } from "@danielfroz/sloth";

@Route('/echo/save')                                   // path lives next to the handler
export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  async handle(cmd: EchoSaveCommand): Promise<EchoSaveCommandResult> { /* ... */ }
}

@Route('/echo/get', { scope: DI.Scope.Transient })    // optional per-handler DI scope
export class EchoGetHandler implements QueryHandler<EchoGetQuery, EchoGetQueryResult> { /* ... */ }
```

Then call `.routes()` where you want the discovered controllers to sit in the
middleware chain:

```ts
// inits/Handlers.ts
import "@/handlers/cqrs/index.ts"; // IMPORTANT: import handlers so their @Route decorators run

app.Handlers
  .push(AuthMiddleware)     // runs before controllers
  .routes()                 // all @Route controllers inserted here
  .push(NotFoundMiddleware) // catch-all, last
```

Routes are grouped into one `Controller` per **first path segment**
(`/echo/get` + `/echo/save` → one `/echo` controller). The default scope is
`Singleton`, matching `Controller.add()`.

> **Note:** discovery works by an import-time side effect — a handler is only
> registered if its module is actually imported. Import your handlers barrel
> (e.g. `handlers/cqrs/index.ts`) before calling `.routes()`.

### 2. Manual controllers

Prefer to wire handlers explicitly? `Controller.add()` is fully supported and
interchangeable with `@Route` (both bundled examples use `@Route` discovery; the
manual style below remains a first-class alternative).

```ts
export const EchoController = new Controller('/echo')
  .add({ endpoint: '/get', handler: EchoGetHandler }, { scope: DI.Scope.Transient })
  .add({ endpoint: '/save', handler: EchoSaveHandler })

app.Handlers.push(AuthMiddleware).push(EchoController).push(NotFoundMiddleware)
```

## Middleware

Middlewares are plain functions (Oak ctx-style or Express req/res-style) that
resolve their own dependencies via `container.resolve()`. Sloth does not hide the
framework API — you get the native `Context` / `Request`/`Response`. There are
two ways to apply them, and they compose.

### Global pipeline

Declare the whole request pipeline in one structured call. Middlewares run in
array order: `before` → controllers → `after`.

```ts
app.Handlers.pipeline({
  before: [ LogMiddleware ],       // run before every controller (logging, cors, ...)
  after:  [ NotFoundMiddleware ],  // catch-all, runs last
  // @Route-discovered controllers are inserted automatically between before/after
})
```

For manual controllers (no `@Route` discovery), pass them and turn discovery off:

```ts
app.Handlers.pipeline({
  before: [ AuthMiddleware ],
  controllers: [ EchoController ],
  after: [ NotFoundMiddleware ],
  discover: false,
})
```

`pipeline()` is sugar over `push()`/`routes()`, which remain available if you
prefer to assemble the order by hand.

### Per-route (scoped) middleware

Attach middleware to a single endpoint, declared right on the handler — ideal for
"auth on writes, public reads". The adapter runs them before the handler for that
route only; a middleware that doesn't call `next()` short-circuits it.

```ts
@Route('/echo/save', { use: [AuthMiddleware] })   // scoped to this endpoint
export class EchoSaveHandler implements CommandHandler<...> { ... }

@Route('/echo/get')                                // public — no middleware
export class EchoGetHandler implements QueryHandler<...> { ... }
```

Per-route middleware also works in the manual style:
`new Controller('/echo').add({ endpoint: '/save', handler: EchoSaveHandler, middlewares: [AuthMiddleware] })`.

> Both bundled examples (`examples/oak` and `examples/express`) use `@Route`
> discovery with a global `Log` + `Auth` `before` pipeline and a `NotFound`
> `after` — the same shape on each adapter. Per-route middleware is documented
> above as an alternative.

## Handler Scope

Handlers are resolved from the DI container **per request**, and the default
scope is `Singleton` — so one handler instance serves every request. This is the
right default **as long as your handlers are stateless**: keep all per-request
data in the `cmd`/`query` argument and in `handle()` locals, and use instance
fields only for injected dependencies.

> **Single-threaded does not mean safe.** Node/Deno run on one thread, but the
> event loop interleaves requests at every `await`. A `Singleton` handler that
> stores per-request data on `this` and reads it back across an `await` will leak
> or corrupt state between concurrent requests:
>
> ```ts
> @Route('/x/do')                 // Singleton (default) → one shared instance
> class BadHandler {
>   private userId!: string       // per-request state on `this` — the bug
>   async handle(cmd) {
>     this.userId = cmd.userId            // request A writes 'A'
>     const u = await this.repo.get(this.userId)   // ← await yields the event loop
>     //   request B runs here: this.userId = 'B'  (overwrites the shared field)
>     return { id: this.userId }          // request A returns 'B' — wrong
>   }
> }
> ```

For a **stateless** handler, `Singleton` and `Transient` behave identically, and
`Singleton` is cheaper (no per-request allocation) — so prefer it. Reach for
`{ scope: DI.Scope.Transient }` (a fresh instance per request) only when a handler
genuinely must hold per-request state; staying stateless is the better fix. Scope
is set where you map the route (see [Defining endpoints](#defining-endpoints)).

## Lazy injection (circular dependencies)

Dependencies wired with `DI.inject(token)` are resolved **eagerly**, the moment
the owner is constructed. When two services depend on each other, that recursion
has nowhere to bottom out and the container throws `circular dependency detected`.

`DI.lazy(token)` is the fix. It returns a transparent proxy and defers resolution
until the **first time you use the dependency** (resolved once, then memoized).
Because the owner finishes constructing before the cycle closes, it is cached as a
singleton — so when the other side resolves back to it, it gets the existing
instance instead of recursing.

Swap `inject` → `lazy` on **one edge** of the cycle. Call sites don't change:

```ts
class A {
  constructor(private readonly b = DI.lazy(Types.B)) {}   // ← lazy breaks the cycle
  run() { return this.b.help() }                          // B resolved here, on first use
}

class B {
  constructor(private readonly a = DI.inject(Types.A)) {} // ← eager is fine on the other edge
  help() { /* ... */ }
}
```

Notes:

- Only the **injection** is deferred — don't *call* a lazy dependency inside the
  constructor body (that would resolve it during construction and reintroduce the
  cycle). Using it in `handle()` / methods is exactly right.
- Method members are bound to the resolved instance, so `#private` fields and
  fluent `return this` work normally.
- As a bonus, `lazy` removes registration-order sensitivity: the token only needs
  to be registered before it is first *used*, not before it is injected.

### Fail fast at boot — `warmup()`

Because `inject` resolves on construction and `lazy` resolves on first use, a
missing or misconfigured dependency surfaces *when it's first touched* — for a
lazy edge, possibly on a request rather than at startup. `warmup()` restores
fail-fast: it eagerly resolves every registered class/factory token once, so the
whole graph is validated (and singletons pre-built) before you serve traffic.

```ts
await app.start({ port: 3000, warmup: true }) // validate the graph, then listen
// or call it yourself once everything is registered:
app.warmup() // { resolved: <count> }  — throws Errors.InitError listing failures
```

Singletons are constructed and cached; transients are validated and discarded;
value providers are skipped. It's safe alongside `lazy` (proxies don't recurse —
each target token is validated on its own). It's opt-in: `start()` does not warm
up unless you pass `{ warmup: true }`.

## Upgrading

Moving from 0.1.x to 0.2.0? See **[MIGRATION.md](MIGRATION.md)** — most changes
are opt-in and backward compatible (`Controller.add()` / `app.Handlers.push()`
still work); only `Errors.AuthError` (now 2-arg) and `Errors.CodeDescriptionError`
→ `Errors.CodeError` are breaking.

Using an LLM agent? This repo ships **Claude Code skills** in
[`.claude/skills/`](https://github.com/danielfroz/sloth/tree/main/.claude/skills): `sloth-migrate` (modernize an existing
service to 0.2.0) and `sloth-scaffold` (add a new `@Route` endpoint).

## Contributing

We welcome contributions! If you'd like to help improve Sloth, feel free to
submit a pull request or open an issue. Before contributing, please review our
Contributing Guidelines.

## Disclaimer

⚠️ **Warning:** This project is still under active development. Interfaces and
object contracts are subject to change. A stable `1.0` release will be published
once the project is validated and stabilized.
