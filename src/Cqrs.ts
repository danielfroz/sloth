export interface Base {
  id: string
  sid: string
}
export interface BaseResult {
  id: string
  sid: string
  error?: {
    code: string
    message: string
  }
}
export interface Query extends Base {}
export interface QueryResult extends BaseResult {}
export interface Command extends Base {}
export interface CommandResult extends BaseResult {}

export interface BaseHandler<T extends Base, TR extends BaseResult> {
  handle(base: T): Promise<TR>
}
export interface QueryHandler<T extends Query, TR extends QueryResult> {
  handle(query: T): Promise<TR>
}
export interface CommandHandler<T extends Command, TR extends CommandResult> {
  handle(command: T): Promise<TR>
}