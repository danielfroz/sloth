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

> Both bundled examples — **[examples/oak](https://github.com/danielfroz/sloth/tree/main/examples/oak)**
> and **[examples/express](https://github.com/danielfroz/sloth/tree/main/examples/express)** —
> use `@Route` discovery with a global `Log` + `Auth` `before` pipeline and a
> `NotFound` `after` — the same shape on each adapter. Per-route middleware is
> documented above as an alternative. Look at the examples for a full, runnable
> reference.

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

## Dependency injection (lazy by default)

`DI.inject(token)` is **lazy by default**, and that one rule removes a whole class
of problems — circular dependencies and "register things in the right order":

- A **class** dependency is returned as a transparent proxy that constructs on
  **first use**. So two services can depend on each other and it just works — the
  owner finishes constructing (and is cached) before the cycle closes, with **no
  annotation**:

  ```ts
  class A {
    constructor(private readonly b = DI.inject(Types.B)) {} // plain inject
    run() { return this.b.help() }                          // B built here, on first use
  }
  class B {
    constructor(private readonly a = DI.inject(Types.A)) {} // mutual — no special handling
    help() { /* ... */ }
  }
  ```

- A **value / factory** dependency (a Log, a Mongo `Database`, a secret string, a
  URI) is resolved **eagerly** and returned directly — primitives work, because a
  proxy can't wrap a primitive.

- An **unregistered token** throws at inject time — which, under `warmup` (below),
  means **at boot**, not on some later request.

Notes:

- Don't *call* a dependency inside the constructor body — using it in `handle()` /
  methods is what you want (and what keeps cycles from materialising early).
- Methods are bound to the real instance (cached), so `#private` fields and fluent
  `return this` work. The cost of lazy object deps is a tiny per-access proxy hop
  and `dep instanceof Class` being `false`; values/primitives are unaffected.
- Registration order is irrelevant — a token only has to be registered before it's
  first *used*.

### Fail fast at boot — `warmup()`

`warmup()` eagerly resolves every registered class/factory token once, so the whole
graph is validated (and singletons pre-built) before you serve traffic. It runs in
`start()` **by default**:

```ts
await app.start({ port: 3000 })             // warmup runs automatically
await app.start({ port: 3000, warmup: false }) // …unless you opt out
app.warmup() // { resolved: <count> } — or throws Errors.InitError listing failures
```

Even though `inject` is lazy, warmup catches missing wiring: constructing each
registered class runs its constructor, and `inject`'s **lookup** is eager, so an
unregistered/typo'd token throws here. Singletons are constructed and cached,
transients validated and discarded, value providers skipped.

## Bootstrapping a service

Registration splits in two, and Sloth handles each with the right tool:

- **Order-free class bindings** (repositories, services) — declare them with
  `@Repository` / `@Service` (aliases of `@Provide`) and register them all with
  `app.Providers.discover()`. No `inits/Repositories.ts` to maintain.
- **Ordered I/O bootstrap** (logger, secrets, DB connection, API clients, event
  bus) — write each as an `Initializer` and run them, in order, with
  `app.Inits.run(...)`.

```ts
// repositories/mongo/OrderMongo.ts — binding lives on the implementation
@Repository(Types.Repos.Order)
export class OrderMongo implements OrderRepository { /* ... */ }

// inits/Secret.ts — a unit of imperative bootstrap
export class SecretInit implements Initializer {
  async init() {
    const api = new ApiFetch(); api.init({ base, throwOnError: false })
    container.register(Types.SecretClient, { useValue: new SecretClient(api) })
  }
}

// main.ts
import '@/repositories/mongo/index.ts'   // side-effect: run @Repository decorators
import '@/handlers/cqrs/index.ts'         // side-effect: run @Route decorators

const app = new Application({ framework: new OakFramework() })
app.Providers.discover()                                  // register @Repository/@Service classes
await app.Inits.run(LogInit, SecretInit, MongoInit, ApiInit, EventsInit) // ordered bootstrap
app.Handlers.pipeline({ before: [HealthMiddleware], after: [NotFoundMiddleware] })
await app.start({ port: 3000 })                           // warmup (default) → listen
```

For decorator-free or one-off bindings, register directly with
`container.register(token, { useClass | useValue | useFactory }, { scope? })` —
the same primitive used inside initializers.

### Calling an external API from a Service

A `@Service` is the natural home for outbound HTTP. Register a configured
`ApiFetch` client in an `Initializer`, inject it into the service, and map the
upstream payload into your own DTO so handlers never see the raw shape:

```ts
// inits/Api.ts
export class ApiInit implements Initializer {
  init() {
    const github = new ApiFetch().init({ base: 'https://api.github.com', throwOnError: true })
    container.register(Types.Api.Github, { useValue: github })   // a value → injected eagerly
  }
}

// services/GithubService.ts
@Service(Types.Services.Github)
export class GithubService {
  constructor(private readonly api = DI.inject(Types.Api.Github)) {}
  async getRepo(owner: string, name: string): Promise<Repo> {
    const r = await this.api.get<GithubRepo>({
      url: `/repos/${owner}/${name}`,
      headers: { 'User-Agent': 'sloth-example' }, // GitHub requires a User-Agent
    })
    return { fullName: r.full_name, stars: r.stargazers_count, /* … map fields … */ }
  }
}

// handlers/cqrs/repo/GetHandler.ts
@Route('/repo/get')
export class RepoGetHandler implements QueryHandler<RepoGetQuery, RepoGetQueryResult> {
  constructor(private readonly github = DI.inject(Types.Services.Github)) {}
  async handle({ id, sid, owner, name }: RepoGetQuery): Promise<RepoGetQueryResult> {
    return { id, sid, repo: await this.github.getRepo(owner, name) }
  }
}
```

A non-2xx response throws `Errors.ApiError`, which the adapter maps to the matching
HTTP status. The full, runnable version is in
**[examples/oak](https://github.com/danielfroz/sloth/tree/main/examples/oak)** (and
**[examples/express](https://github.com/danielfroz/sloth/tree/main/examples/express)**) —
`POST /repo/get { "owner": "danielfroz", "name": "sloth" }`.

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
