import { Types } from "@/types.ts";
import { ConsoleLog } from "@danielfroz/slog";
import { container } from "@danielfroz/sloth";

export const init = async () => {
  const log = new ConsoleLog({
    init: { service: '@danielfroz/sloth:examples.express'}
  })
  container.register(Types.Log, { useValue: log })
}