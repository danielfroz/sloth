import { Application, Log, Repos } from './inits/index.ts';

try {
  await Log.init()
  await Repos.init()
  await Application.init()
}
catch(err) {
  console.error(err)
}
