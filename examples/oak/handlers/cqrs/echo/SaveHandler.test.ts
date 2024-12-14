import { Echo, EchoRepository, EchoSaveCommand, EchoSaveHandler } from "@/models/index.ts";
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
    assert(res.response != null)
    assert(res.response === 'Hello world', `expected Hello world but got ${res.response}`)
  })
})