import { Types } from "@/types.ts";
import { JsonLog } from "@danielfroz/slog";
import { container } from "@danielfroz/sloth";

export const init = async () => {
  const log = new JsonLog({
    init: { service: '@danielfroz/sloth:examples.oak'}
  })
  container.register(Types.Log, { useValue: log })
}