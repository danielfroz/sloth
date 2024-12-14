import { Echo } from '@/models/dtos/index.ts';

export interface EchoRepository {
  get(id: string): Promise<Echo|undefined>
  save(echo: Echo): Promise<void>
}
