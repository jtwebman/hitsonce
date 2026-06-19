// Cookieless visitor identity: a per-domain, per-day salted hash of IP + user agent.
// Nothing is stored on the device and the day rotates, so it isn't durably
// identifying — the basis for banner-free analytics. The `day` rotates on the
// configured timezone's civil day (see lib/time.ts), so the hash changes at local
// midnight rather than UTC midnight.

export async function visitorHash(p: {
  salt: string;
  day: string;
  ip: string;
  ua: string;
}): Promise<string> {
  const input = `${p.salt}|${p.day}|${p.ip}|${p.ua}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
