import { ConsoleLog } from "@danielfroz/slog";
import { Application } from "@danielfroz/sloth";
import { OakFramework } from "@danielfroz/sloth/oak";

export const app = new Application({
  framework: new OakFramework(),
  log: new ConsoleLog({ init: { service: 'example.oak' }})
})