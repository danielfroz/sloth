export const Scope = {
  Transient: "Transient",
  Singleton: "Singleton",
} as const;

export type Scope = typeof Scope[keyof typeof Scope];
