import { container } from "@danielfroz/slothcore";
import { EchoMem } from "../repositories/mem/index.ts";
import { Types } from "../types.ts";

export const init = async () => {
  container.register(Types.Repos.Echo, { useClass: EchoMem })
}