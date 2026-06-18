import { UAParser } from 'ua-parser-js';

export interface ParsedUA {
  browser: string | null;
  os: string | null;
  device: 'mobile' | 'tablet' | 'desktop';
}

// Normalize a User-Agent into browser / OS / device class. ua-parser-js reports
// device.type only for mobile/tablet/etc.; everything else we treat as desktop.
export function parseUserAgent(ua: string): ParsedUA {
  const r = new UAParser(ua).getResult();
  const type = r.device.type;
  const device = type === 'mobile' ? 'mobile' : type === 'tablet' ? 'tablet' : 'desktop';
  return { browser: r.browser.name ?? null, os: r.os.name ?? null, device };
}
