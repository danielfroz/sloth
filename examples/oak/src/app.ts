import { JsonLog } from "@danielfroz/slog";
import { Application } from "@danielfroz/sloth";
import { OakFramework } from "@danielfroz/sloth/oak";

export const app = new Application({
  framework: new OakFramework(),
  log: new JsonLog({ init: { service: 'example.oak' }})
})