import { EchoSaveHandler } from "@/handlers/cqrs/echo/index.ts";
import { EchoSaveCommand } from '@/models/cqrs/echo/index.ts';
import { Echo } from '@/models/dtos/index.ts';
import { EchoRepository } from '@/repositories/index.ts';
import { Errors } from "@danielfroz/sloth";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { beforeEach, describe, it } from '@std/testing/bdd';
import { stub } from '@std/testing/mock';

describe('EchoSaveHandler', () => {
  let handler: EchoSaveHandler

  const echoDb = new Map<string, Echo>()

  // A handler is a plain class: unit test it by constructing it with a stubbed
  // dependency and calling handle() — no DI container or HTTP server required.
  beforeEach(() => {
    echoDb.clear()
    const repo = {} as EchoRepository
    stub(repo, 'save', (echo: Echo) => {
      echoDb.set(echo.id, echo)
      return Promise.resolve()
    })

    handler = new EchoSaveHandler(repo)
  })

  it('saves the echo and returns it', async () => {
    const id = crypto.randomUUID()
    const res = await handler.handle({
      id,
      sid: id,
      auth: '1', // injected by AuthMiddleware from the Authorization header
      text: 'Hello world'
    } as EchoSaveCommand)

    assert(res != null)
    assertEquals(res.id, id)
    assertEquals(res.sid, id)
    assert(res.echo != null)
    assertEquals(res.echo.text, 'Hello world')

    // the repository received the echo
    assert(echoDb.get(id) != null, 'expected the echo to be saved')
  })

  it('rejects when the command is null', async () => {
    await assertRejects(
      () => handler.handle(null as unknown as EchoSaveCommand),
      Errors.ArgumentError,
      'cmd',
    )
  })

  it('rejects when cmd.id is missing', async () => {
    await assertRejects(
      () => handler.handle({ sid: 's', auth: '1', text: 'Hello world' } as EchoSaveCommand),
      Errors.ArgumentError,
      'cmd.id',
    )
  })

  it('rejects when cmd.text is missing', async () => {
    const id = crypto.randomUUID()
    await assertRejects(
      () => handler.handle({ id, sid: id, auth: '1' } as EchoSaveCommand),
      Errors.ArgumentError,
      'cmd.text',
    )
  })

  it('rejects unauthorized requests when auth is missing', async () => {
    const id = crypto.randomUUID()
    await assertRejects(
      () => handler.handle({ id, sid: id, text: 'Hello world' } as EchoSaveCommand),
      Errors.AuthError,
      'permission denied',
    )
    // nothing was persisted
    assertEquals(echoDb.size, 0)
  })
})
