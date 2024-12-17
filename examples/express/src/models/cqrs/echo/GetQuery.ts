import { Echo } from "@/models/dtos/index.ts";
import { Query, QueryResult } from "@danielfroz/sloth";

export interface EchoGetQuery extends Query {}
export interface EchoGetQueryResult extends QueryResult {
  echo?: Echo
}