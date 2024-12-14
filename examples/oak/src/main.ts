import { Context, Next, Application as OakApplication } from "@oak/oak";
import { app } from "./app.ts";
import { Controllers, Repos } from './inits/index.ts';

try {
  await Repos.init()
  await Controllers.init()

  /**
   * Accessing the framework Container
   * In this case we're accessing the Oak server application.
   * note that casting is necessary as container() can be anything; depends really on Framework's implementation
   */
  const oakapp = app.container() as OakApplication
  /**
   * Example of middleware created directly from Oak/oak
   * 
   * This allow us to extend the implementation as needed...
   * Even create Routers manually
   */
  oakapp.use(async (ctx: Context, next: Next) => {
    const start = new Date().getTime()
    await next()
    const end = new Date().getTime()
    console.log(`request to ${ctx.request.url} served in ${end - start} ms`)
  })
  // hooking to Oak Event Listener
  oakapp.addEventListener('listen', ({ port, host }) => {
    console.log(`listening on port ${port}`)
  })
  await app.start({ port: 4000 })
}
catch(err) {
  console.error(err)
}
