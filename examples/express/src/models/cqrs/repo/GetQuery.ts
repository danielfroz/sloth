import { Repo } from "@/models/dtos/index.ts";
import { Query, QueryResult } from "@danielfroz/sloth";

export interface RepoGetQuery extends Query {
  owner: string
  name: string
}

export interface RepoGetQueryResult extends QueryResult {
  repo: Repo
}
