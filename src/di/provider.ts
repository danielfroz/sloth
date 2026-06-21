import type { Constructor } from "./token.ts";

/**
 * Provider type — how the container builds the value for a token.
 */
export type Provider<Value = any> =
  | ClassProvider<Value & object>
  | FactoryProvider<Value>
  | ValueProvider<Value>;

/**
 * Class provider — the container instantiates the class (honouring its scope).
 */
export interface ClassProvider<Instance extends object> {
  readonly useClass: Constructor<Instance>;
}

/**
 * Factory provider — the container calls the factory (honouring its scope).
 */
export interface FactoryProvider<Value> {
  readonly useFactory: () => Value;
}

/**
 * Value provider — the container returns the value as-is (always a constant).
 */
export interface ValueProvider<T> {
  readonly useValue: T;
}

// @internal
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T & object> {
  return "useClass" in provider;
}

// @internal
export function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
  return "useFactory" in provider;
}

// @internal
export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return "useValue" in provider;
}
