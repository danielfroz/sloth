/**
 * A trimmed view of a GitHub repository — the fields we surface in the Result.
 */
export interface Repo {
  fullName: string
  description?: string
  stars: number
  forks: number
  language?: string
}
