import { Application } from "@danielfroz/slothcore";
import { OakFramework } from "@danielfroz/slothoak";

export const app = new Application({
  framework: new OakFramework<any>()
})