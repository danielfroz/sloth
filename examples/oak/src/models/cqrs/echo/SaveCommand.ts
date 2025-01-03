import { Echo } from "@/models/dtos/index.ts"
import { Command, CommandResult } from "@danielfroz/sloth"

export interface EchoSaveCommand extends Command {
  auth: string
  text: string
}
export interface EchoSaveCommandResult extends CommandResult {
  echo?: Echo
}

