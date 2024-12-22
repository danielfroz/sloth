import { app } from "./app.ts";
import { Controllers, Express, Log, Repos } from './inits/index.ts';

try {
  await Log.init()
  await Repos.init()
  await Express.init()
  await Controllers.init()
  await app.start({ port: 4000 })
}
catch(err) {
  console.error(err)
}
