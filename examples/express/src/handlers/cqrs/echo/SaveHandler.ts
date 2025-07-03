import { EchoSaveCommand, EchoSaveCommandResult } from "@/models/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, DI, Errors } from "@danielfroz/sloth";

/**
 * This is a protected handler.
 * Only authorized requests are allowed to save information to the system
 * So we enforce at this handler checking if cmd.auth has passed on the request
 * The information comes from the Authorization header
 * @see middlewares/Auth.ts code for detailed implementation
 */
export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly echoRepo = DI.inject(Types.Repos.Echo),
    private readonly log = DI.inject(Types.Log)
  ) {}

  async handle(cmd: EchoSaveCommand): Promise<EchoSaveCommandResult> {
    if(!cmd)
      throw new Errors.ArgumentError('cmd')
    if(!cmd.id)
      throw new Errors.ArgumentError('cmd.id')
    if(!cmd.text)
      throw new Errors.ArgumentError('cmd.text')
    if(!cmd.auth)
      throw new Errors.AuthError('unauthorized', 'permission denied', 'invalid request')

    const { id, sid, text } = cmd
    const log = this.log.child({ handler: 'echo.Save', sid })

    const echo = {
      id,
      text
    }

    await this.echoRepo.save(echo)

    log.info({ msg: `echo saved with text: ${echo.text}`})
    
    return {
      id,
      sid,
      echo
    }
  }
}