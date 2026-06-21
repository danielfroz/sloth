import { Types } from "@/types.ts";
import { JsonLog } from "@danielfroz/slog";
import { container, Initializer } from "@danielfroz/sloth";

// An Initializer is the unit of ordered, imperative bootstrap. Here it just
// builds the logger and registers it; real services chain Secret → Mongo → Api →
// Events the same way, via app.Inits.run(...).
export class LogInit implements Initializer {
  init() {
    const log = new JsonLog({
      init: { service: 'examples.express' }
    })
    container.register(Types.Log, { useValue: log })
  }
}
