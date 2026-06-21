/**
 * A unit of imperative startup work — connect to a database, load secrets, build
 * configured API clients, create and `init()` an event bus, etc.
 *
 * Initializers run **in order** through {@link Application.Inits}.run(...), which
 * resolves each one through the container (so constructor DI works) and awaits
 * `init()`. Order matters for I/O bootstrap (e.g. Log before Secret before Mongo),
 * which is why the sequence is explicit at the call site rather than discovered.
 *
 * @example
 * ```ts
 * export class SecretInit implements Initializer {
 *   constructor(private readonly log = inject(Types.Log)) {}
 *   async init() {
 *     const api = new ApiFetch(); api.init({ base, throwOnError: false })
 *     container.register(Types.SecretClient, { useValue: new SecretClient(api) })
 *   }
 * }
 * ```
 */
export interface Initializer {
  init(): Promise<void> | void;
}
