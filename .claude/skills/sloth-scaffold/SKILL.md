---
name: sloth-scaffold
description: Scaffold a new CQRS endpoint for a @danielfroz/sloth service in the modern 0.2.0 style — a Command/Query + Result type, a @Route-decorated handler with constructor DI, and (optionally) per-route middleware, wired with no controllers/*.ts boilerplate. Use when a user wants to add a new endpoint/handler/route to a Sloth service.
---

# Scaffold a Sloth endpoint (0.2.0 style)

Create a new endpoint as a `@Route`-decorated handler. No `controllers/*.ts` file
is needed — discovery + `app.Handlers.pipeline()/.routes()` assemble it. See
`MIGRATION.md` and the README in the sloth repo for the full contract.

## Gather

- **Domain** (e.g. `echo`), **action** (e.g. `get`, `save`), and whether it's a
  **Query** (read) or **Command** (write).
- **Path** — defaults to `/<domain>/<action>`.
- **Fields** on the input beyond the envelope (`id`, `sid`, `author?` come from
  `Command`/`Query`) and on the result.
- **Dependencies** to inject (repositories/services via DI tokens in `types.ts`).
- **Auth?** If the endpoint needs it, add route-scoped middleware via `use`.

## Generate

Match the project's existing layout (typically `handlers/cqrs/<domain>/` and
either `commons` types or local `models/cqrs/<domain>/`).

1. **Types** (local-models style shown; or add to `commons`):

```ts
import { Command, CommandResult } from "@danielfroz/sloth";

export interface EchoSaveCommand extends Command {   // id, sid, author? included
  text: string
}
export interface EchoSaveCommandResult extends CommandResult {
  echo?: Echo
}
```
Use `Query`/`QueryResult` for reads.

2. **Handler** with `@Route` + constructor DI + validation:

```ts
import { CommandHandler, DI, Errors, Route } from "@danielfroz/sloth";
import { Types } from "@/types.ts";

@Route('/echo/save')                                  // add { use: [AuthMiddleware] } if protected
export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly repo = DI.inject(Types.Repos.Echo),
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
**Keep the handler stateless:** instance fields are for injected dependencies
only — put all per-request data in the `cmd`/`query` arg and `handle()` locals.
The default `Singleton` scope shares one instance across requests, and the event
loop interleaves them at every `await`, so per-request state on `this` leaks
between requests (single-threaded ≠ safe). Use `{ scope: DI.Scope.Transient }`
only when a handler genuinely must hold per-request state.

3. **Export** the handler from the barrel (`handlers/cqrs/<domain>/index.ts` and
   up) so its `@Route` decorator runs when the barrel is imported at startup.

## Wire (once per app, not per endpoint)

Ensure the app imports the handlers barrel and uses discovery:

```ts
import '@/handlers/cqrs/index.ts'
app.Handlers.pipeline({ before: [LogMiddleware], after: [NotFoundMiddleware] })
```

## Verify

- `sh ./compile.sh` (or `deno check src/main.ts`) is clean.
- Add a unit test: `new` the handler with a stubbed dependency and assert on
  `handle()` (handlers are plain classes — no container needed).
- Optionally run the service and POST to the new path.
