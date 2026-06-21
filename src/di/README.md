# DI

Originally forked from https://github.com/exuanbo/di-wise, this container has
been slimmed down to the surface Sloth actually uses: `Type` tokens, `Scope`
(Singleton | Transient), `register` / `resolve`, the `inject` default-parameter
helper, and `lazy` for breaking circular dependencies. The general-purpose
di-wise features (decorators, multi-provider resolution, child containers,
container middleware, builder tokens) were removed.

Original work © its authors, MIT.
