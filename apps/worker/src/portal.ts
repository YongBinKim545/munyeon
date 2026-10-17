import { XMLParser } from 'fast-xml-parser';

export type SourceKind = 'hospital' | 'pharmacy';

export const SOURCES: Record<SourceKind, { url: string }> = {
  hospital: { url: 'https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncFullDown' },
  pharmacy: { url: 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyFullDown' },
};

/** 포털 게이트웨이 오류(키 오류·한도 초과 등)나 기관 API 오류. 빈 목록으로 해석하면 안 된다. */
export class PortalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'PortalError';
  }
}

/** URL·메시지에서 인증키를 가린다. 키는 어떤 로그에도 남기지 않는다. */
export function redactKey(s: string): string {
  let out = s.replace(/(serviceKey=)[^&\s]*/gi, '$1***');
  const key = process.env.DATA_GO_KR_KEY;
  if (key) {
    for (const v of [key, encodeURIComponent(key)]) out = out.split(v).join('***');
  }
  return out;
}

const parser = new XMLParser({ parseTagValue: false, trimValues: true, isArray: (name) => name === 'item' });

export interface Page {
  totalCount: number;
  items: Record<string, string>[];
}

export function parsePage(xml: string): Page {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new PortalError('MALFORMED', 'response is not XML');
  }
  const envelope = doc?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (envelope) {
    throw new PortalError(String(envelope.returnReasonCode ?? 'GATEWAY'), String(envelope.returnAuthMsg ?? envelope.errMsg ?? 'gateway error'));
  }
  const header = doc?.response?.header;
  if (!header) throw new PortalError('MALFORMED', 'missing response header');
  if (String(header.resultCode) !== '00') {
    throw new PortalError(String(header.resultCode), String(header.resultMsg ?? 'result error'));
  }
  const body = doc.response.body ?? {};
  const raw: unknown[] = body.items?.item ?? [];
  const items = raw.map((it) => {
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(it as Record<string, unknown>)) {
      if (v !== '' && v !== null && v !== undefined) rec[k] = String(v);
    }
    return rec;
  });
  return { totalCount: Number(body.totalCount ?? 0), items };
}

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/**
 * 공공데이터포털 API 한 번 호출. 네트워크·5xx·형식 오류는 재시도하고, 포털의 명시적 오류(키·한도)는 바로 던진다.
 * params에 serviceKey는 넣지 않는다(여기서 환경변수로 붙인다).
 */
export async function fetchPortal(baseUrl: string, params: Record<string, string | number>, label: string, opts: FetchOptions = {}): Promise<Page> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error('DATA_GO_KR_KEY is not set');
  const { retries = 3, timeoutMs = 180_000, retryDelayMs = 5_000, fetchImpl = fetch } = opts;
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const url = `${baseUrl}?serviceKey=${encodeURIComponent(key)}&${query}`;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parsePage(await res.text());
    } catch (e) {
      if (e instanceof PortalError && e.code !== 'MALFORMED') throw new PortalError(e.code, redactKey(e.message));
      lastError = e;
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(redactKey(`${label} failed after ${retries + 1} attempts: ${msg}`));
}

/** FullData 한 페이지 */
export function fetchFullDataPage(kind: SourceKind, pageNo: number, numOfRows = 10000, opts: FetchOptions = {}): Promise<Page> {
  return fetchPortal(SOURCES[kind].url, { pageNo, numOfRows }, `${kind} page ${pageNo}`, opts);
}
