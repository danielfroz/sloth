# Releases

Release notes for `@danielfroz/sloth`, newest first. Each file mirrors the
GitHub release for that tag.

| Version | Notes | Highlights |
|---|---|---|
| [0.3.3](./0.3.3.md) | 2026-07-15 | Fix Oak multipart parser stack overflow (`Maximum call stack size exceeded`) on large file uploads; chunked base64 encoding |
| [0.3.2](./0.3.2.md) | 2026-07-10 | `ApiFetch` granular network-error classification (`connection.refused`/`timeout`/`reset`/`dns` → 502/503/504), response-parse errors, opt-in request `timeout` |
| [0.3.1](./0.3.1.md) | 2026-06-21 | Docs/maintenance patch (JSR explicit-return-type convention + required `deno publish --dry-run`); no API changes |
| [0.3.0](./0.3.0.md) | 2026-06-21 | Lean DI, lazy-by-default `inject`, `warmup()` on by default, `@Repository`/`@Service` + `Initializer` bootstrap, Singleton default scope |
| [0.2.0](./0.2.0.md) | 2026-06-21 | `@Route` discovery, `pipeline()`, per-route middleware, Express 5 |

For step-by-step upgrade instructions see [MIGRATION.md](../MIGRATION.md).
