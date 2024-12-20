import type { Container } from "./container.ts";
import { assert } from "./errors.ts";
import type { InstanceRef } from "./instance.ts";
import type { Provider } from "./provider.ts";
import type { Scope } from "./scope.ts";
import { createContext } from "./utils/context.ts";
import { KeyedStack } from "./utils/keyed-stack.ts";
import { WeakRefMap } from "./utils/weak-ref-map.ts";

export interface InjectionContext {
  container: Container;
  resolution: Resolution;
}

export interface Resolution {
  stack: KeyedStack<Provider, ResolutionFrame>;
  instances: WeakRefMap<Provider, InstanceRef>;
  dependents: WeakRefMap<Provider, InstanceRef>;
}

export interface ResolutionFrame {
  scope: Exclude<Scope, typeof Scope.Transient>;
  provider: Provider;
}

// @internal
export function createResolution(): Resolution {
  return {
    stack: new KeyedStack(),
    instances: new WeakRefMap(),
    dependents: new WeakRefMap(),
  };
}

// @internal
export const [provideInjectionContext, useInjectionContext] = createContext<InjectionContext>();

// @internal
export function ensureInjectionContext(fn: Function) {
  const context = useInjectionContext();
  assert(context, `${fn.name}() can only be used within an injection context`);
  return context;
}
