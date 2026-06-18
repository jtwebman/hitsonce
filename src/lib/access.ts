import { createRemoteJWKSet, jwtVerify } from 'jose';

// Cache the remote JWKS per team domain (it self-refreshes on key rotation).
type RemoteJWKS = ReturnType<typeof createRemoteJWKSet>;
const jwksCache = new Map<string, RemoteJWKS>();

function getJwks(teamDomain: string): RemoteJWKS {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

// Verifies a Cloudflare Access JWT (RS256, keys from the team JWKS) and returns the
// authenticated email. Throws on any failure (bad signature, issuer, audience, expiry).
export async function verifyAccess(
  token: string,
  teamDomain: string,
  aud: string,
): Promise<string> {
  const { payload } = await jwtVerify(token, getJwks(teamDomain), {
    issuer: `https://${teamDomain}`,
    audience: aud,
  });
  const email = typeof payload.email === 'string' ? payload.email : null;
  if (!email) throw new Error('Access token has no email claim');
  return email;
}
