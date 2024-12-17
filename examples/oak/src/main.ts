import { app } from "./app.ts";
import { Controllers, Middleware, Repos } from './inits/index.ts';

try {
  await Repos.init()
  await Middleware.init()
  await Controllers.init()
  await app.start({ port: 4000 })
}
catch(err) {
  console.error(err)
}
