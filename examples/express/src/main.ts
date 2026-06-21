import { container } from "@danielfroz/sloth";
import { App, Log, Repos } from './inits/index.ts';
import { Types } from "./types.ts";

try {
  await Log.init()
  await Repos.init()
  await App.init()
}
catch(err: Error|any) {
  const log = container.resolve(Types.Log)
  if(log) {
    log.error({ msg: 'main error caught', error: err.message, stack: err.stack })
  }
  else {
    console.error('main error caught: %o', err.message)
    err.stack ? console.error(err.stack): {}
  }
  Deno.exit(1)
}
