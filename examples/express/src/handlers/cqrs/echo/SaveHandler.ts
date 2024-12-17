import { EchoSaveCommand, EchoSaveCommandResult } from "@/models/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, DI, Errors } from "@danielfroz/sloth";

export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly echoRepo = DI.inject(Types.Repos.Echo)
  ) {
    console.log('EchoSaveHandler() called')
  }

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