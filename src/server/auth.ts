import { eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { organizationMembers, profiles } from '#/db/schema'
import { createServerSupabase } from '#/lib/supabase/server'
import type { OrgContext } from '#/lib/types'

export async function requireOrgContext(): Promise<OrgContext> {
  const { supabase } = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  const db = getDb()
  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, user.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  })

  if (!membership) {
    throw new Error('No organization membership')
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  })

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    organizationId: membership.organizationId,
    orgRole: membership.role,
  }
}

export async function getOptionalUser() {
  const { supabase } = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
