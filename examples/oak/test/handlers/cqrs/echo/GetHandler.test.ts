import { EchoGetHandler } from "@/handlers/cqrs/echo/index.ts";
import { EchoGetQuery } from '@/models/cqrs/echo/index.ts';
import { Echo } from '@/models/dtos/index.ts';
import { EchoRepository } from '@/repositories/index.ts';
import { Errors } from "@danielfroz/sloth";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { beforeEach, describe, it } from '@std/testing/bdd';
import { stub } from '@std/testing/mock';

describe('EchoGetHandler', () => {
  let handler: EchoGetHandler

  const echoDb = new Map<string, Echo>()

  // A handler is a plain class: unit test it by constructing it with a stubbed
  // dependency and calling handle() — no DI container or HTTP server required.
  beforeEach(() => {
    echoDb.clear()
    const repo = {} as EchoRepository
    stub(repo, 'get', (id: string) => Promise.resolve(echoDb.get(id)))

    handler = new EchoGetHandler(repo)
  })

  it('returns the stored echo', async () => {
    const id = crypto.randomUUID()
    echoDb.set(id, { id, text: 'Hello world' })

    const res = await handler.handle({ id, sid: id } as EchoGetQuery)
    assert(res != null)
    assertEquals(res.id, id)
    assertEquals(res.sid, id)
    assert(res.echo != null)
    assertEquals(res.echo.text, 'Hello world')
  })

  it('returns an undefined echo when none exists', async () => {
    const id = crypto.randomUUID()

    const res = await handler.handle({ id, sid: id } as EchoGetQuery)
    assert(res != null)
    assertEquals(res.id, id)
    assertEquals(res.echo, undefined)
  })

  it('rejects when the query is null', async () => {
    await assertRejects(
      () => handler.handle(null as unknown as EchoGetQuery),
      Errors.ArgumentError,
      'query',
    )
  })

  it('rejects when query.id is missing', async () => {
    await assertRejects(
      () => handler.handle({ sid: 's' } as EchoGetQuery),
      Errors.ArgumentError,
      'query.id',
    )
  })
})
