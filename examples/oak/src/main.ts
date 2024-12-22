import { app } from "./app.ts";
import { Handlers, Log, Oak, Repos } from './inits/index.ts';

try {
  await Log.init()
  await Repos.init()
  await Oak.init()
  await Handlers.init()
  await app.start({ port: 4000 })
}
catch(err) {
  console.error(err)
}
