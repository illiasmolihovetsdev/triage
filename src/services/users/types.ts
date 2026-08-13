import type { Role } from '@/generated/prisma/enums'

/*
 * The shape selected from Prisma, kept separate from the UI model it is mapped
 * into. Naming it here keeps the mapping function testable without importing
 * Prisma's generated argument types into component code.
 */
export interface MembershipWithUserAndWorkspace {
  role: Role
  user: {
    id: string
    name: string
    email: string
  }
  workspace: {
    name: string
  }
}
