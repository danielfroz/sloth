import { EchoSaveCommand, EchoSaveCommandResult } from "@/handlers/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, Errors } from "@danielfroz/slothcore";
import { inject } from "@exuanbo/di-wise";

export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly echoRepo = inject(Types.Repos.Echo)
  ) {}

  async handle(cmd: EchoSaveCommand): Promise<EchoSaveCommandResult> {
    if(!cmd)
      throw new Errors.ArgumentError('cmd')
    if(!cmd.text)
      throw new Errors.ArgumentError('cmd.text')

    const { id, sid, text } = cmd

    const echo = {
      id,
      text
    }
    await this.echoRepo.save(echo)
    
    return {
      id,
      sid,
      echo
    }
  }
}