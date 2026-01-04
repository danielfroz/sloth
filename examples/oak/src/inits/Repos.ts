import { EchoMem } from "@/repositories/mem/index.ts";
import { Types } from "@/types.ts";
import { container } from '@danielfroz/sloth';

export const init = async () => {
  const echo = new EchoMem()
  container.register(Types.Repos.Echo, { useValue: echo })
}