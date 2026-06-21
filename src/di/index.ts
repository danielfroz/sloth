/**
 * A small, opinionated DI container for Sloth.
 *
 * Originally a fork of https://github.com/exuanbo/di-wise, since slimmed down to
 * the surface Sloth actually uses: token + scope, register/resolve, an `inject`
 * default-parameter helper, and `lazy` for breaking circular dependencies.
 */
export { type Container, createContainer, type RegistrationOptions } from "./container.ts";
export { inject, lazy } from "./inject.ts";
export type { ClassProvider, FactoryProvider, Provider, ValueProvider } from "./provider.ts";
export { Scope } from "./scope.ts";
export { Type } from "./token.ts";
export type { Constructor, Token, TokenList } from "./token.ts";
