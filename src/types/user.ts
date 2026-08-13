import type { Role } from '@/generated/prisma/enums'

/*
 * UI-facing user models. Prisma record types stay inside data access code; the
 * components depend on these instead, so the database shape can change without
 * rippling through the interface.
 *
 * WorkspaceRole is derived from the generated Prisma enum rather than written
 * out by hand, so adding a role to the schema is a type error here instead of a
 * silent mismatch.
 */
export type WorkspaceRole = Lowercase<Role>

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
}

export interface UserOption {
  id: string
  name: string
  email: string
  workspaceName: string
  role: WorkspaceRole
}
