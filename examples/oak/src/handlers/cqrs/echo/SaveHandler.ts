import { AuthMiddleware } from "@/middlewares/index.ts";
import { EchoSaveCommand, EchoSaveCommandResult } from "@/models/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, DI, Errors, Route } from "@danielfroz/sloth";

/**
 * This is a protected handler.
 * Only authorized requests are allowed to save information to the system.
 *
 * Auth is declared as a ROUTE-SCOPED middleware via @Route({ use: [...] }), so it
 * runs only for this endpoint — `/echo/get` stays public. The middleware passes
 * the token down via ctx.state, and this handler still enforces cmd.auth, giving
 * both Authn (middleware) and Authz (handler).
 *
 * The route is declared inline with @Route; default scope is Singleton.
 */
@Route('/echo/save', { use: [AuthMiddleware] })
export class EchoSaveHandler implements CommandHandler<EchoSaveCommand, EchoSaveCommandResult> {
  constructor(
    private readonly echoRepo = DI.inject(Types.Repos.Echo)
  ) {}

  async handle(cmd: EchoSaveCommand): Promise<EchoSaveCommandResult> {
    if(!cmd)
      throw new Errors.ArgumentError('cmd')
    if(!cmd.id)
      throw new Errors.ArgumentError('cmd.id')
    if(!cmd.text)
      throw new Errors.ArgumentError('cmd.text')
    if(!cmd.auth)
      throw new Errors.AuthError('unauthorized', 'permission denied')

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