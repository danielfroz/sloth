import { Echo } from "@/models/dtos/index.ts";
import { EchoRepository } from "../index.ts";

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