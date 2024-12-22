import { app } from '@/app.ts';
import { Types } from "@/types.ts";
import { container } from "@danielfroz/sloth";
import { Context, Next, Application as OakApplication } from "@oak/oak";

export const init = async () => {
  /**
   * Accessing the framework Container
   * In this example we're accessing the Oak server application.
   * note that casting is necessary as container() can be anything; depends really on Framework's implementation
   */
  const oakapp = app.app as OakApplication
  /**
   * Example of middleware created directly with Oak/oak
   * 
   * This allow us to extend the implementation as needed...
   * The only problem working with this approach is that you can't controll the initialization order.
   * All the framework middlwares are initialized prior to the Controllers / Routers.
   * 
   * Therefore if you want to apply a logic for a particular Middleware must run right before
   * a particular Controller or a Middleware that runs after all Controllers, then you must use 
   * Sloth.Middlewares instead.
   */
  oakapp.use(async (ctx: Context, next: Next) => {
    const log = container.resolve(Types.Log)
    const start = new Date().getTime()
    await next()
    const end = new Date().getTime()
    log.info(`request to ${ctx.request.url} served in ${end - start} ms`)
  })

  // hooking to Oak Event Listener
  oakapp.addEventListener('listen', ({ port }) => {
    const log = container.resolve(Types.Log)
    log.info(`listening on port ${port}`)
  })
}