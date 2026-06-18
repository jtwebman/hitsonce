// Cookieless visitor identity: a per-domain, per-day salted hash of IP + user agent.
// Nothing is stored on the device and the day rotates, so it isn't durably
// identifying — the basis for banner-free analytics.

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

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
