import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { google } from 'googleapis'
import { getDb } from '#/db'
import { gmailConnections, gmailOauthStates } from '#/db/schema'
import { decryptText, encryptText } from '#/server/storage'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

function oauthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
  }
}

export function oauthConfigured() {
  const c = oauthConfig()
  return Boolean(c.clientId && c.clientSecret && c.redirectUri)
}

export async function buildAuthorizeUrl(orgId: string, userId: string) {
  const { clientId, redirectUri } = oauthConfig()
  if (!clientId || !redirectUri) throw new Error('Google OAuth env vars not configured')
  const state = randomBytes(24).toString('base64url')
  const db = getDb()
  await db.insert(gmailOauthStates).values({ state, organizationId: orgId, userId })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export async function exchangeCode(code: string, state: string) {
  const db = getDb()
  const row = await db.query.gmailOauthStates.findFirst({ where: eq(gmailOauthStates.state, state) })
  if (!row) throw new Error('Invalid OAuth state')
  await db.delete(gmailOauthStates).where(eq(gmailOauthStates.state, state))

  const { clientId, clientSecret, redirectUri } = oauthConfig()
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) throw new Error('Token exchange failed')
  const tokenData = (await tokenRes.json()) as Record<string, unknown>

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth2.setCredentials({
    access_token: tokenData.access_token as string,
    refresh_token: tokenData.refresh_token as string,
    scope: SCOPES.join(' '),
    token_type: 'Bearer',
  })
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const emailAddress = profile.data.emailAddress ?? ''

  const credsJson = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    scope: SCOPES.join(' '),
    token_type: 'Bearer',
    client_id: clientId,
    client_secret: clientSecret,
  })

  await db
    .insert(gmailConnections)
    .values({
      organizationId: row.organizationId,
      userId: row.userId,
      emailAddress,
      credentialsEncrypted: encryptText(credsJson),
      scopes: SCOPES,
    })
    .onConflictDoUpdate({
      target: [gmailConnections.organizationId, gmailConnections.userId],
      set: {
        emailAddress,
        credentialsEncrypted: encryptText(credsJson),
        scopes: SCOPES,
        updatedAt: new Date(),
      },
    })

  return { email_address: emailAddress, organization_id: row.organizationId }
}

export async function getConnection(orgId: string, userId: string) {
  const db = getDb()
  return db.query.gmailConnections.findFirst({
    where: and(eq(gmailConnections.organizationId, orgId), eq(gmailConnections.userId, userId)),
  })
}

export async function deleteConnection(orgId: string, userId: string) {
  const db = getDb()
  const result = await db
    .delete(gmailConnections)
    .where(and(eq(gmailConnections.organizationId, orgId), eq(gmailConnections.userId, userId)))
    .returning({ id: gmailConnections.id })
  return result.length > 0
}

export async function getGmailServiceForUser(orgId: string, userId: string) {
  const conn = await getConnection(orgId, userId)
  if (!conn) throw new Error('Gmail not connected — connect in Settings')
  const credsJson = JSON.parse(decryptText(conn.credentialsEncrypted)) as Record<string, string>
  const { clientId, clientSecret, redirectUri } = oauthConfig()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth2.setCredentials({
    access_token: credsJson.access_token,
    refresh_token: credsJson.refresh_token,
    scope: credsJson.scope,
    token_type: credsJson.token_type,
  })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

export async function gmailStatus(orgId: string, userId: string) {
  if (!oauthConfigured()) return { ready: false, error: 'Google OAuth not configured on server' }
  const conn = await getConnection(orgId, userId)
  if (!conn) return { ready: false, error: 'Gmail not connected', connect_available: true }
  try {
    const gmail = await getGmailServiceForUser(orgId, userId)
    const profile = await gmail.users.getProfile({ userId: 'me' })
    return {
      ready: true,
      from_email: profile.data.emailAddress,
      connected_at: conn.connectedAt.toISOString(),
    }
  } catch (e) {
    return { ready: false, error: String(e), connect_available: true }
  }
}

export { SCOPES }
