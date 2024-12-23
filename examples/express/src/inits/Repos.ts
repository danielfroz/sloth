import { EchoMem } from "@/repositories/mem/index.ts";
import { Types } from "@/types.ts";
import { container } from '@danielfroz/sloth';

export const init = async () => {
  // registering handler using the EchoMem handler
  container.register(Types.Repos.Echo, { useClass: EchoMem })
}