import { EchoSaveCommand, EchoSaveCommandResult } from "@/models/cqrs/echo/index.ts";
import { Types } from '@/types.ts';
import { CommandHandler, DI, Errors, Route } from "@danielfroz/sloth";

/**
 * A protected write handler.
 *
 * Auth is GLOBAL (see main.ts: `before: [ auth({ except: ['/repo/get'] }) ]`), so
 * every route — including this one — requires a token; only `/repo/get` is public.
 * The middleware passes the token down via res.locals, and this handler also checks
 * `cmd.auth`, giving both Authn (middleware) and Authz (handler).
 *
 * (For the inverse — auth on only a few routes — scope it instead with
 * `@Route('/echo/save', { use: [auth()] })`; see the README "Middleware".)
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