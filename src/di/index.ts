/**
 * Code created by and available at https://github.com/exuanbo/di-wise
 * Very minor modifications... just to facilitate the Sloth Application's context
 */
export { createContainer } from "./container.ts";
export type { Container, ContainerOptions } from "./container.ts";
export { AutoRegister, Inject, Injectable, InjectAll, Scoped } from "./decorators.ts";
export type { ClassDecorator, ClassFieldDecorator } from "./decorators.ts";
export { inject, injectAll, injectBy, Injector } from "./inject.ts";
export { applyMiddleware } from "./middleware.ts";
export type { Middleware, MiddlewareComposer } from "./middleware.ts";
export type { ClassProvider, FactoryProvider, Provider, ValueProvider } from "./provider.ts";
export { Build, Value } from "./registry.ts";
export type { RegistrationOptions } from "./registry.ts";
export { Scope } from "./scope.ts";
export { Type } from "./token.ts";
export type { Constructor, Token, TokenList } from "./token.ts";

