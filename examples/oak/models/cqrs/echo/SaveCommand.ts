import { Echo } from "@/models/dtos/index.ts"
import { Command, CommandResult } from "@danielfroz/slothcore"

export interface EchoSaveCommand extends Command {
  text: string
}
export interface EchoSaveCommandResult extends CommandResult {
  echo?: Echo
}
