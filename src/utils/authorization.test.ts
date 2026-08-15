import { describe, expect, it } from 'vitest'
import {
  canRolePerformAction,
  doesActionRequireClaimer,
  getAuthorizationDecision,
} from '@/utils/authorization'
import type {
  AuthorizationDecisionInput,
  ItemAction,
  ItemAuthRecord,
  MembershipAuthRecord,
} from '@/types/authz'
import type { AuthenticatedUser } from '@/types/user'
import type { Role } from '@/generated/prisma/enums'

/*
 * The authorization module is the R2 security boundary. These tests pin the
 * role matrix and the 401/403/404 distinction so a later Route Handler cannot
 * quietly change "other workspace" into 403 and leak that the item exists.
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BILLING_WORKSPACE_ID = 'ws_billing'

const alice: AuthenticatedUser = {
  id: 'user_alice',
  name: 'Alice Nguyen',
  email: 'alice@triage.test',
}

const dave: AuthenticatedUser = {
  id: 'user_dave',
  name: 'Dave Okafor',
  email: 'dave@triage.test',
}

const erin: AuthenticatedUser = {
  id: 'user_erin',
  name: 'Erin Walsh',
  email: 'erin@triage.test',
}

const bob: AuthenticatedUser = {
  id: 'user_bob',
  name: 'Bob Marsh',
  email: 'bob@triage.test',
}

const createMembership = (
  userId: string,
  workspaceId: string,
  role: Role
): MembershipAuthRecord => ({ userId, workspaceId, role })

const createItem = (
  claimedById: string | null,
  workspaceId: string = SUPPORT_WORKSPACE_ID
): ItemAuthRecord => ({
  id: 'item_support_1',
  workspaceId,
  claimedById,
})

const getDecision = (
  input: Partial<AuthorizationDecisionInput> & { action: ItemAction }
) =>
  getAuthorizationDecision({
    user: input.user !== undefined ? input.user : alice,
    item: input.item !== undefined ? input.item : createItem(alice.id),
    membership:
      input.membership !== undefined
        ? input.membership
        : createMembership(alice.id, SUPPORT_WORKSPACE_ID, 'OWNER'),
    action: input.action,
  })

describe('canRolePerformAction', () => {
  const actionList: ItemAction[] = ['read', 'claim', 'resolve', 'release']

  it.each([
    ['OWNER', 'read', true],
    ['OWNER', 'claim', true],
    ['OWNER', 'resolve', true],
    ['OWNER', 'release', true],
    ['MEMBER', 'read', true],
    ['MEMBER', 'claim', true],
    ['MEMBER', 'resolve', true],
    ['MEMBER', 'release', true],
    ['VIEWER', 'read', true],
    ['VIEWER', 'claim', false],
    ['VIEWER', 'resolve', false],
    ['VIEWER', 'release', false],
  ] as const)('%s %s → %s', (role, action, isAllowed) => {
    expect(canRolePerformAction(role, action)).toBe(isAllowed)
  })

  it('covers every role and action pair in the matrix', () => {
    const roleList: Role[] = ['OWNER', 'MEMBER', 'VIEWER']
    const pairCount = roleList.flatMap((role) =>
      actionList.map((action) => canRolePerformAction(role, action))
    ).length

    expect(pairCount).toBe(12)
  })
})

describe('doesActionRequireClaimer', () => {
  it('requires the current claimer for resolve and release', () => {
    expect(doesActionRequireClaimer('resolve')).toBe(true)
    expect(doesActionRequireClaimer('release')).toBe(true)
  })

  it('does not require the current claimer for read or claim', () => {
    expect(doesActionRequireClaimer('read')).toBe(false)
    expect(doesActionRequireClaimer('claim')).toBe(false)
  })
})

describe('getAuthorizationDecision', () => {
  it('returns 401 when there is no authenticated user', () => {
    const decision = getDecision({ user: null, action: 'read' })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    })
  })

  it('returns 404 when the item does not exist', () => {
    const decision = getDecision({ item: null, action: 'read' })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns 404 when the caller has no membership in the item workspace', () => {
    const decision = getDecision({
      user: erin,
      item: createItem(null),
      membership: null,
      action: 'read',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns 404 rather than 403 for a cross-workspace membership', () => {
    const decision = getDecision({
      user: erin,
      item: createItem(null, SUPPORT_WORKSPACE_ID),
      membership: createMembership(erin.id, BILLING_WORKSPACE_ID, 'OWNER'),
      action: 'claim',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('uses the same 404 body for a missing item and a cross-workspace item', () => {
    const missingItemDecision = getDecision({
      user: erin,
      item: null,
      membership: createMembership(erin.id, BILLING_WORKSPACE_ID, 'OWNER'),
      action: 'read',
    })
    const crossWorkspaceDecision = getDecision({
      user: erin,
      item: createItem(null, SUPPORT_WORKSPACE_ID),
      membership: null,
      action: 'read',
    })

    expect(missingItemDecision).toEqual(crossWorkspaceDecision)
  })

  it('returns 403 when a viewer tries to claim', () => {
    const decision = getDecision({
      user: dave,
      item: createItem(null),
      membership: createMembership(dave.id, SUPPORT_WORKSPACE_ID, 'VIEWER'),
      action: 'claim',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  })

  it('returns 403 when a viewer tries to resolve or release, even if they appear as claimer', () => {
    const viewerMembership = createMembership(
      dave.id,
      SUPPORT_WORKSPACE_ID,
      'VIEWER'
    )
    const claimedByViewer = createItem(dave.id)

    expect(
      getDecision({
        user: dave,
        item: claimedByViewer,
        membership: viewerMembership,
        action: 'resolve',
      })
    ).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })

    expect(
      getDecision({
        user: dave,
        item: claimedByViewer,
        membership: viewerMembership,
        action: 'release',
      })
    ).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
  })

  it('allows a viewer to read an item in their workspace', () => {
    const decision = getDecision({
      user: dave,
      item: createItem(alice.id),
      membership: createMembership(dave.id, SUPPORT_WORKSPACE_ID, 'VIEWER'),
      action: 'read',
    })

    expect(decision.isAuthorized).toBe(true)
  })

  it('allows a member to claim an unclaimed item', () => {
    const decision = getDecision({
      user: bob,
      item: createItem(null),
      membership: createMembership(bob.id, SUPPORT_WORKSPACE_ID, 'MEMBER'),
      action: 'claim',
    })

    expect(decision).toMatchObject({
      isAuthorized: true,
      role: 'MEMBER',
      workspaceId: SUPPORT_WORKSPACE_ID,
    })
  })

  it('allows a member to claim an item already held by someone else (conflict is not an authz question)', () => {
    const decision = getDecision({
      user: bob,
      item: createItem(alice.id),
      membership: createMembership(bob.id, SUPPORT_WORKSPACE_ID, 'MEMBER'),
      action: 'claim',
    })

    expect(decision.isAuthorized).toBe(true)
  })

  it('returns 403 when a member tries to resolve another member\'s claim', () => {
    const decision = getDecision({
      user: bob,
      item: createItem(alice.id),
      membership: createMembership(bob.id, SUPPORT_WORKSPACE_ID, 'MEMBER'),
      action: 'resolve',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 403,
      code: 'NOT_CLAIMER',
    })
  })

  it('returns 403 when an owner tries to release another member\'s claim', () => {
    const decision = getDecision({
      user: alice,
      item: createItem(bob.id),
      membership: createMembership(alice.id, SUPPORT_WORKSPACE_ID, 'OWNER'),
      action: 'release',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 403,
      code: 'NOT_CLAIMER',
    })
  })

  it('allows the current claimer to resolve and release', () => {
    const bobMembership = createMembership(
      bob.id,
      SUPPORT_WORKSPACE_ID,
      'MEMBER'
    )
    const claimedByBob = createItem(bob.id)

    expect(
      getDecision({
        user: bob,
        item: claimedByBob,
        membership: bobMembership,
        action: 'resolve',
      }).isAuthorized
    ).toBe(true)

    expect(
      getDecision({
        user: bob,
        item: claimedByBob,
        membership: bobMembership,
        action: 'release',
      }).isAuthorized
    ).toBe(true)
  })

  it('returns 403 when resolve is attempted on an unclaimed item', () => {
    const decision = getDecision({
      user: bob,
      item: createItem(null),
      membership: createMembership(bob.id, SUPPORT_WORKSPACE_ID, 'MEMBER'),
      action: 'resolve',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 403,
      code: 'NOT_CLAIMER',
    })
  })

  it('does not treat a membership for a different user as access', () => {
    const decision = getDecision({
      user: bob,
      item: createItem(null),
      membership: createMembership(alice.id, SUPPORT_WORKSPACE_ID, 'OWNER'),
      action: 'read',
    })

    expect(decision).toMatchObject({
      isAuthorized: false,
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })
})
