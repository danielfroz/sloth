export type TokenList<Values extends unknown[]> =
  { [Index in keyof Values]: Token<Values[Index]> };

/**
 * Token type — either a {@link Type} token or a class constructor.
 */
export type Token<Value = any> = Value extends object
  ? Type<Value> | Constructor<Value>
  : Type<Value>;

/**
 * Type API — an opaque, named token used to register and resolve a value in the
 * container.
 */
export interface Type<A> {
  /**
   * Name of the type.
   */
  readonly name: string;
}

/**
 * Create a type token.
 *
 * @example
 * ```ts
 * const Spell = Type<Spell>("Spell");
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function Type<T>(typeName: string): Type<T> {
  const type = {
    name: `Type<${typeName}>`,
    toString() {
      return type.name;
    },
  };
  return type;
}

/**
 * Constructor type.
 */
export interface Constructor<Instance extends object> {
  new (...args: []): Instance;
}

// @internal
export function isConstructor<T>(token: Type<T> | Constructor<T & object>): token is Constructor<T & object> {
  return typeof token == "function";
}
