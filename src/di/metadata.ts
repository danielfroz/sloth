import type { ClassProvider } from "./provider.ts";
import type { Scope } from "./scope.ts";
import type { Constructor, Token } from "./token.ts";

export interface Metadata<This extends object = any> {
  autoRegister?: boolean;
  scope?: Scope;
  tokens: Token<This>[];
  provider: ClassProvider<This>;
}

// @internal
export function getMetadata<T extends object>(Class: Constructor<T>): Metadata<T> {
  let metadata = metadataMap.get(Class);
  if (!metadata) {
    metadataMap.set(Class, metadata = {
      tokens: [],
      provider: {useClass: Class},
    });
  }
  return metadata;
}

const metadataMap = new WeakMap<Constructor<object>, Metadata>();