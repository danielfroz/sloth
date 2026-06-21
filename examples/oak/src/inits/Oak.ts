import { app } from '@/app.ts';
import { Types } from "@/types.ts";
import { container } from "@danielfroz/sloth";
import { Application as OakApplication } from "@oak/oak";

export const init = async () => {
  /**
   * Accessing the framework Container.
   * In this example we're accessing the Oak server application directly — useful
   * for framework-native hooks that Sloth doesn't wrap.
   *
   * Note: request-timing logging used to live here as a raw oakapp.use(); it now
   * lives as a proper Sloth `before` middleware (middlewares/Log.ts), wired via
   * app.Handlers.pipeline() so its ordering relative to controllers is explicit.
   */
  const oakapp = app.app as OakApplication

  // hooking to Oak Event Listener
  oakapp.addEventListener('listen', ({ port }) => {
    const log = container.resolve(Types.Log)
    log.info(`listening on port ${port}`)
  })
}