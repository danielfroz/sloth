import { Echo } from "@/models/dtos/index.ts";
import { Query, QueryResult } from "@danielfroz/slothcore";

export interface EchoGetQuery extends Query {}
export interface EchoGetQueryResult extends QueryResult {
  echo?: Echo
}