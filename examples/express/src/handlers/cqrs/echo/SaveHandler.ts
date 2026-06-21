import { EchoSaveCommand, EchoSaveCommandResult } from "@/models/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, DI, Errors, Route } from "@danielfroz/sloth";

/**
 * This is a protected handler — only authorized requests may write.
 *
 * The endpoint is declared with @Route (no controllers/*.ts). Auth is applied
 * globally in the pipeline `before` (see inits/App.ts): the AuthMiddleware passes
 * the token down via res.locals, and this handler additionally checks cmd.auth,
 * giving both Authn (middleware) and Authz (handler).
 *
 * (For endpoint-specific auth you could instead scope it with
 * @Route('/echo/save', { use: [AuthMiddleware] }) — see the README "Middleware".)
 *
 * @see middlewares/Auth.ts for the middleware implementation.
 */
@Route('/echo/save')
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