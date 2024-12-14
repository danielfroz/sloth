import { app } from "@/app.ts";
import { EchoController } from "@/controllers/index.ts";

export const init = async () => {
  app.addController(EchoController)
}