# Migrating to Sloth 0.3.0

Sloth 0.3.0 **slims the DI container** down to the surface services actually use,
and adds two capabilities: `DI.lazy` (break circular dependencies) and
`warmup()` (fail fast at boot). For the overwhelming majority of services the
upgrade is **just a version bump** — the kept API (`DI.inject`, `DI.Type`,
`DI.Scope`, `container.register`/`resolve`) is unchanged.

## Prerequisite

Bump the dependency to **0.3.0** in `deno.json` (and `deno.local.json` if you use
a split config):

```jsonc
"@danielfroz/sloth": "jsr:@danielfroz/sloth@0.3.0"
```

## Kept (no change)

`DI.inject(token)`, `DI.Type<T>(name)`, `DI.Scope` (`Singleton` | `Transient`),
`container.register(token, provider, options?)` (with `useClass`/`useValue`/
`useFactory`), and `container.resolve(token)` keep the same signatures and
semantics.

## Behavior change — default scope is now `Singleton`

`container.register(token, { useClass })` **without** an explicit `{ scope }` now
defaults to **`Singleton`** (it was `Transient` in di-wise). This aligns the bare
`register` call with `Controller.add`, `@Route`, and `ServiceBuilder.addClass`,
which already default to `Singleton`.

**Practically:** a repo/service registered in `inits/*` without a scope is now a
**single shared instance** instead of one per injecting handler.

**Is it safe?** Yes for the standard pattern: anything injected into a `Singleton`
handler is *already* shared across that handler's concurrent requests, so your
repos/services already had to be stateless/concurrency-safe. Sharing them across
handlers too adds no new requirement.

**If a dependency genuinely needs a fresh instance per resolve**, opt back in:

```ts
container.register(Types.Repos.Thing, { useClass: ThingRepo }, { scope: DI.Scope.Transient })
```

## Removed (breaking — but unused)

These di-wise features were removed because **no service and no framework code**
used them. If you somehow do, here's the replacement:

| Removed | Replacement |
|---|---|
| `@Injectable` / `@Scoped` / `@AutoRegister` / `@Inject` / `@InjectAll` | Register explicitly: `container.register(token, { useClass }, { scope })` |
| `injectAll` / `InjectAll` / `container.resolveAll` | Resolve a single token; model collections explicitly |
| `injectBy` / `inject.by` / `Injector` token | `DI.lazy(token)` (cleaner circular-dependency break) |
| multi-token `inject(a, b, …)` ("first registered wins") | Inject one concrete token |
| `container.createChild()` (child/parent containers) | `createContainer()` for isolated graphs (e.g. tests) |
| container middleware (`applyMiddleware`, `resolveAllSafe`) | — |
| `Build(...)` / `Value(...)` builder tokens | `{ useFactory }` / `{ useValue }` |
| `Type.inter` / `Type.union` | Separate tokens |

## New

- **`DI.lazy(token)`** — transparent proxy, resolves on first use; swap
  `inject`→`lazy` on one edge of a cycle to break it. See the README
  **"Lazy injection"** section.
- **`warmup()`** — `app.start({ warmup: true })`, `app.warmup()`, or
  `container.warmup()` eagerly resolve the graph at boot so failures surface
  early. Opt-in. See the README **"Fail fast at boot"** section.

---

# Migrating to Sloth 0.2.0

Sloth 0.2.0 makes endpoints and middleware **less boilerplate, more declarative**.
Almost everything here is **opt-in and backward compatible** — `Controller.add()`
and `app.Handlers.push()` still work exactly as before, so you can adopt the new
patterns gradually, one handler at a time. Only two items are genuinely breaking
(see [Breaking changes](#breaking-changes)).

> This guide is written so a human **or an LLM** (Claude Code, etc.) can apply it.
> For an automated pass, see the `sloth-migrate` skill in `.claude/skills/`.

## Prerequisite

Bump the dependency to **0.2.0** in `deno.json` (and `deno.local.json` if you use
a split config):

```jsonc
"@danielfroz/sloth": "jsr:@danielfroz/sloth@0.2.0"
```

## TL;DR — what changes

| Old (≤ 0.1.x) | New (0.2.0) | Kind |
|---|---|---|
| `controllers/*.ts` + `Controller.add()` | `@Route(path)` on the handler + `app.Handlers.routes()` | optional |
| `.push(Auth).routes().push(NotFound)` | `app.Handlers.pipeline({ before, after })` | optional |
| Global auth middleware + handler re-checks `cmd.auth` | per-route `@Route(path, { use: [Auth] })` | optional |
| `npm:express@4` | `npm:express@5` | opt-in (Express services) |
| `new Errors.AuthError(code, msg, desc)` | `new Errors.AuthError(code, msg)` | **breaking** |
| `Errors.CodeDescriptionError` | `Errors.CodeError` | **breaking** |

---

## 1. Route discovery with `@Route` (optional)

Instead of maintaining a `controllers/` file per domain and registering each
endpoint by hand, declare the route **on the handler** and let the app assemble
the controllers at startup.

**Before**

```ts
// controllers/Echo.ts
export const EchoController = new Controller('/echo')
  .add({ endpoint: '/get',  handler: EchoGetHandler }, { scope: DI.Scope.Transient })
  .add({ endpoint: '/save', handler: EchoSaveHandler })

// inits/Handlers.ts
app.Handlers.push(AuthMiddleware).push(EchoController).push(NotFoundMiddleware)
```

**After**

```ts
// handlers/cqrs/echo/GetHandler.ts
@Route('/echo/get', { scope: DI.Scope.Transient })
export class EchoGetHandler implements QueryHandler<EchoGetQuery, EchoGetQueryResult> { /* ... */ }

// handlers/cqrs/echo/SaveHandler.ts
@Route('/echo/save')
export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> { /* ... */ }

// inits/Handlers.ts
import '@/handlers/cqrs/index.ts'   // IMPORTANT: import handlers so their @Route decorators run
app.Handlers.push(AuthMiddleware).routes().push(NotFoundMiddleware)
```

Then you can delete `controllers/Echo.ts` (and its `index.ts`).

Notes:
- Routes group into **one `Controller` per first path segment** — `/echo/get` +
  `/echo/save` → a single `/echo` controller.
- A missing leading slash is auto-normalized (`echo/get` == `/echo/get`); an
  empty/whitespace path throws `Errors.ArgumentError`.
- Default scope is `Singleton` (same as `Controller.add()`); pass
  `{ scope: DI.Scope.Transient }` for a fresh instance per request.
- **Discovery is an import-time side effect** — a handler is only registered if
  its module is imported. Keep a barrel (`handlers/cqrs/index.ts`) and
  side-effect-import it before `routes()`/`pipeline()`.

---

## 2. Structured global pipeline (optional)

`app.Handlers.pipeline({ before, after })` declares the whole request order in one
place: `before` middlewares → controllers → `after` middlewares.

**Before**

```ts
app.Handlers
  .push(AuthMiddleware)
  .routes()
  .push(NotFoundMiddleware)
```

**After**

```ts
app.Handlers.pipeline({
  before: [ AuthMiddleware ],      // run before every controller
  after:  [ NotFoundMiddleware ],  // catch-all, runs last
  // @Route-discovered controllers are inserted automatically in between
})
```

For **manual controllers** (no `@Route`), pass them explicitly and turn discovery
off:

```ts
app.Handlers.pipeline({
  before: [ AuthMiddleware ],
  controllers: [ EchoController ],
  after: [ NotFoundMiddleware ],
  discover: false,
})
```

`pipeline()` is pure sugar over `push()`/`routes()` — both remain available.

---

## 3. Per-route (scoped) middleware (optional)

Previously all middleware was global; a common pattern was a global `Auth` plus
each handler re-checking `cmd.auth`. You can now scope middleware to a single
endpoint, declared right on the handler — e.g. *auth on writes, public reads*.

**Before** — global auth applies to everything:

```ts
app.Handlers.push(AuthMiddleware).routes().push(NotFoundMiddleware)
```

**After** — auth only where needed:

```ts
@Route('/echo/save', { use: [AuthMiddleware] })   // protected
export class EchoSaveHandler implements CommandHandler<...> { /* ... */ }

@Route('/echo/get')                                // public
export class EchoGetHandler implements QueryHandler<...> { /* ... */ }

// pipeline no longer needs a global Auth:
app.Handlers.pipeline({ before: [ LogMiddleware ], after: [ NotFoundMiddleware ] })
```

Per-route middleware also works in the manual style:

```ts
new Controller('/echo')
  .add({ endpoint: '/save', handler: EchoSaveHandler, middlewares: [AuthMiddleware] })
```

A route-scoped middleware that doesn't call `next()` short-circuits the handler,
exactly like a global one.

---

## 4. Express 5 (Express-based services)

The Express adapter now targets **Express 5** (`npm:express@5`, `npm:multer@2`).
Update the pin in your service's `deno.json` import map:

```jsonc
"express": "npm:express@^5.2.1"
```

The Sloth adapter only uses API stable across v4→v5 (literal route paths,
`express.json()`, `express.urlencoded({ extended: true })`, `new express.Router()`,
`res.status().json()`), so no adapter changes are needed. The path-to-regexp v8
change in Express 5 only affects wildcard patterns, which Sloth doesn't use. Deno
auto-resolves `@types/express@5`. Regenerate the lockfile and run your suite. If
your **own** code uses Express wildcards or removed v4 APIs directly, review the
[Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html).

---

## Breaking changes

These require edits regardless of whether you adopt the new patterns.

### `Errors.AuthError` is now 2-arg

```ts
// before
throw new Errors.AuthError('unauthorized', 'permission denied', 'invalid request')
// after
throw new Errors.AuthError('unauthorized', 'permission denied')
```

### `Errors.CodeDescriptionError` → `Errors.CodeError`

```ts
// before
throw new Errors.CodeDescriptionError('domain.error', 'message')
// after
throw new Errors.CodeError('domain.error', 'message')
```

---

## Migration checklist

1. Bump `@danielfroz/sloth` to `0.2.0` (both `deno.json` and `deno.local.json`).
2. **Breaking:** replace 3-arg `AuthError(...)` with 2-arg; replace
   `CodeDescriptionError` with `CodeError`.
3. *(optional)* Add `@Route(path, { scope?, use? })` to handlers; delete the
   matching `controllers/*.ts`; ensure handlers are imported via a barrel.
4. *(optional)* Replace `.push(...).routes().push(...)` with
   `app.Handlers.pipeline({ before, after })` (use `controllers` + `discover:false`
   for manual controllers).
5. *(optional)* Move endpoint-specific middleware from global to
   `@Route(path, { use: [...] })` (or `Controller.add({ ..., middlewares: [...] })`).
6. *(Express services, optional)* Bump `npm:express` to `^5` and regenerate the lock.
7. Verify (below).

## Verify

```sh
sh ./compile.sh   # type-check (or: deno check src/main.ts)
sh ./test.sh      # run tests
```

Then run the service and smoke-test a couple of endpoints (a protected one with
and without auth, plus an unknown route for the 404 path).

## Do I have to migrate?

No. `Controller.add()` and `app.Handlers.push()` are fully supported in 0.2.0 — the
manual and decorator styles coexist. Only the two [breaking changes](#breaking-changes)
are mandatory. Everything else is adopt-when-you-want.
