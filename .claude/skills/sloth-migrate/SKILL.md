---
name: sloth-migrate
description: Modernize a service that uses @danielfroz/sloth to the 0.2.0 patterns — bump the dependency, apply the breaking-change fixes (AuthError 2-arg, CodeDescriptionError→CodeError), and optionally adopt @Route discovery, app.Handlers.pipeline(), per-route middleware, and Express 5. Use when a user asks to upgrade/migrate/modernize their Sloth service, or after bumping @danielfroz/sloth to 0.2.0.
---

# Migrate a service to Sloth 0.2.0

You are modernizing a service that depends on `@danielfroz/sloth`. The canonical
reference is **`MIGRATION.md`** in the sloth repo — read it if available
(`/opt/actt/Services/sloth/MIGRATION.md` or the installed package). This skill is
the procedure; MIGRATION.md is the source of truth for the exact before/after.

## Principles

- **Backward compatible:** `Controller.add()` and `app.Handlers.push()` still
  work. Only the two breaking changes below are mandatory; the rest is opt-in.
- **Verify after every phase** with `sh ./compile.sh` (or `deno check src/main.ts`)
  and `sh ./test.sh`. Never leave the service uncompilable.
- **Ask before broad opt-in rewrites.** Always apply the breaking fixes; confirm
  with the user before sweeping `@Route`/`pipeline` adoption across many files.

## Step 1 — Detect

Confirm the service uses Sloth and find old patterns. Run targeted searches:

- Version: `deno.json` / `deno.local.json` → `@danielfroz/sloth` pin.
- Manual controllers: files under `controllers/`, `new Controller(`, `.add({`.
- Manual pipeline: `app.Handlers.push(`, `.routes()`, `as MiddlewareCtx`.
- Breaking — AuthError 3-arg: `grep -rn "AuthError(" src` then inspect arity.
- Breaking — `CodeDescriptionError`.
- Express: `npm:express@4` / `express@^4` in import maps and `src/**`.

## Step 2 — Bump the dependency (always)

Set `@danielfroz/sloth` to `jsr:@danielfroz/sloth@0.2.0` in `deno.json` **and**
`deno.local.json` (keep both in sync; the local file may use a filesystem path —
leave the path, just ensure it points at a 0.2.0 checkout).

## Step 3 — Apply breaking changes (always)

1. `new Errors.AuthError(code, msg, desc)` → `new Errors.AuthError(code, msg)`
   (drop the 3rd argument).
2. `Errors.CodeDescriptionError` → `Errors.CodeError` (same `(code, message)`).

Then `sh ./compile.sh` — it must pass before continuing.

## Step 4 — Optional modernization (confirm scope with the user)

Apply per `MIGRATION.md`:

- **@Route discovery:** add `@Route(path, { scope? })` to each handler matching
  its old `controller.add({ endpoint, handler }, { scope })`; the path is
  `controller.base + endpoint`. Delete the now-empty `controllers/*.ts`. Ensure
  handlers are imported via a barrel (e.g. side-effect `import '@/handlers/cqrs/index.ts'`)
  before `routes()`/`pipeline()`.
- **Pipeline:** replace `.push(A)...routes()...push(B)` with
  `app.Handlers.pipeline({ before: [A], after: [B] })`. For manual controllers,
  pass `controllers: [...]` and `discover: false`.
- **Per-route middleware:** where a global middleware only gated some endpoints,
  move it to `@Route(path, { use: [Mw] })` (or
  `Controller.add({ ..., middlewares: [Mw] })`) and drop it from the global
  pipeline.

## Step 5 — Express 5 (Express services, optional)

Bump `npm:express` to `^5` (and `npm:multer` to `^2`) in the import map,
regenerate the lockfile (`deno cache`/`deno check`), and confirm `deno check`
is clean (Deno auto-resolves `@types/express@5`). Review the user's own code for
Express wildcard routes or removed v4 APIs.

## Step 6 — Verify & report

- `sh ./compile.sh` and `sh ./test.sh` (or the service's equivalents) must pass.
- If feasible, run the service and smoke-test a protected endpoint (with/without
  auth) and an unknown route (404).
- Report: dependency bumped, breaking fixes applied (count), which optional
  patterns adopted, and the verification results. List anything skipped and why.
