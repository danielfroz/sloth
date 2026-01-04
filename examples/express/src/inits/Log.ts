import { Types } from "@/types.ts";
import { JsonLog } from "@danielfroz/slog";
import { container } from "@danielfroz/sloth";

export const init = async () => {
  const log = new JsonLog({
    level: 'INFO',
    init: { service: '@danielfroz/sloth:examples.express'}
  })
  // registering the Log to the DI with the log object / using the Singleton pattern
  container.register(Types.Log, { useValue: log })
}