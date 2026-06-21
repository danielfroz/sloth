import { Echo } from "@/models/dtos/index.ts";
import { Types } from "@/types.ts";
import { Repository } from "@danielfroz/sloth";
import { EchoRepository } from "../index.ts";

// @Repository binds this implementation to its token at import time; the app
// registers it via app.Providers.discover() — no inits/Repos.ts to maintain.
@Repository(Types.Repos.Echo)
export class EchoMem implements EchoRepository {
  private readonly map = new Map<string, string>()

  get(id: string): Promise<Echo|undefined> {
    const text = this.map.get(id)
    if(!text)
      return Promise.resolve(undefined)
    const echo = {
      id,
      text
    } as Echo
    return Promise.resolve(echo)
  }

  save(echo: Echo): Promise<void> {
    const { id, text } = echo
    this.map.set(id, text)
    return Promise.resolve()
  }
}