// The storage port. The app layer talks to the Store in domain objects (camelCase),
// never SQL — so the backend is swappable. The built-in adapter is D1
// (src/data/stores/d1.ts); implement this interface to back HitsOnce with any other
// store (Postgres, Analytics Engine, etc.) and wire it in src/data/createStore.ts.

export type IdentityMode = 'cookieless' | 'cookie';

export interface Domain {
  id: string;
  hostname: string;
  collectorPath: string;
  identityMode: IdentityMode;
  salt: string;
  createdAt: string;
}

export interface NewDomain {
  hostname: string;
  collectorPath?: string;
  identityMode?: IdentityMode;
  salt: string;
}

export interface NewEvent {
  domainId: string;
  visitorHash: string;
  name: string;
  path: string | null;
  referrerHost: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  language: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  screenW: number | null;
  screenH: number | null;
  isBot: boolean;
}

// Stats query window. `from`/`to` are ISO-8601 UTC strings; `to` is exclusive.
export interface StatsQuery {
  domainId: string;
  from: string;
  to: string;
  includeBots?: boolean;
}

export interface CountBucket {
  key: string;
  count: number;
}

export interface DayBucket {
  day: string;
  pageviews: number;
  visitors: number;
}

export interface Stats {
  pageviews: number;
  visitors: number;
  byDay: DayBucket[];
  topPages: CountBucket[];
  topReferrers: CountBucket[];
  countries: CountBucket[];
  devices: CountBucket[];
  browsers: CountBucket[];
}

export interface Store {
  /** Cheap liveness check for /health. */
  ping(): Promise<boolean>;
  getDomainByHost(hostname: string): Promise<Domain | null>;
  listDomains(): Promise<Domain[]>;
  createDomain(input: NewDomain): Promise<Domain>;
  deleteDomain(id: string): Promise<void>;
  insertEvent(event: NewEvent): Promise<void>;
  getStats(query: StatsQuery): Promise<Stats>;
}
