import { Types } from "@/types.ts";
import { ApiFetch, container, Initializer } from "@danielfroz/sloth";

// Builds and registers the external API clients. An Initializer (not a @Provide
// class) because the client needs runtime config — here a constant base URL, in a
// real service the base comes from env/secrets.
export class ApiInit implements Initializer {
  init() {
    const github = new ApiFetch().init({
      base: 'https://api.github.com',
      throwOnError: true,
    })
    container.register(Types.Api.Github, { useValue: github })
  }
}
