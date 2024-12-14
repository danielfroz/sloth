import { EchoSaveHandler } from "@/handlers/cqrs/echo/index.ts";
import { EchoSaveCommand } from '@/models/cqrs/echo/index.ts';
import { Echo } from '@/models/dtos/index.ts';
import { EchoRepository } from '@/repositories/index.ts';
import { assert } from "@std/assert/assert";
import { beforeEach, describe, it } from '@std/testing/bdd';
import { stub } from '@std/testing/mock';

describe('EchoSaveHandler', () => {
  let handler:EchoSaveHandler
  const echoDb = new Map<string, { id: string, text: string }>()

  beforeEach(() => {
    echoDb.clear()
    const repo = {} as EchoRepository
    stub(repo, 'save', async (echo: Echo) => {
      echoDb.set(echo.id, echo)
      return Promise.resolve()
    })

    handler = new EchoSaveHandler(repo)
  })

  it('shall work with full example', async () => {
    const id = crypto.randomUUID()
    const cmd = {
      id,
      sid: id,
      text: 'Hello world'
    } as EchoSaveCommand
    const res = await handler.handle(cmd)
    assert(res != null)
    assert(res.echo != null)
    assert(res.echo.id === id)
    assert(res.echo.text === 'Hello world', `expected Hello world but got ${res.echo.text}`)

    // check the database
    const echo = echoDb.get(id)
    assert(echo != null, `expected echo not be null`)
  })
})