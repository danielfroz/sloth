import { Application } from "@danielfroz/sloth";
import { ExpressFramework } from "@danielfroz/sloth-express";

export const app = new Application({
  framework: new ExpressFramework()
})