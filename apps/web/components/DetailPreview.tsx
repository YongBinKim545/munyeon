'use client';

import type { DetailPreview as Preview } from '@/lib/detailPreview';
import { KIND_LABEL } from '@/lib/seo';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { LiveStatus } from './LiveStatus';
import { StickyCall } from './StickyCall';
import { WeeklyTable } from './WeeklyTable';

/**
 * 서버 상세 페이지가 오기 전에, 메인 목록·이름 검색이 가진 정보로 즉시 그리는 상세(D45).
 * 기관 상세(InstitutionView)와 같은 배치·부품을 써서, 서버 페이지로 바뀔 때 화면이 덜 움직이게 한다.
 */
export function DetailPreview({ p, failed = false, onRetry }: { p: Preview; failed?: boolean; onRetry?: () => void }) {
  const crumbs = ['홈', p.sido, p.sigungu, p.sido && p.sigungu ? KIND_LABEL[p.kind] : null, p.name].filter(Boolean);
  const actions = (
    <div className="actions detail-call">
      <CallButton tel={p.tel} institutionId={p.id} page="detail" />
      <DirectionsButton institutionId={p.id} name={p.name} addr={p.area} lat={p.lat} lon={p.lon} page="detail" />
    </div>
  );
  return (
    <main className="container" aria-busy="true">
      <nav className="breadcrumbs" aria-hidden="true">
        <ol>
          {crumbs.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </nav>
      <h1>{p.name}</h1>
      <p>
        <span className="badges">
          <span className="badge">{p.badge}</span>
          {p.pediatric ? <span className="badge">소아 전문</span> : null}
        </span>
      </p>
      <p className="muted">{p.area}</p>
      {p.hours ? <LiveStatus hours={p.hours} holidays={p.holidays} /> : <div className="status status--unknown" aria-hidden="true" />}
      {actions}
      <p className="notice">등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.</p>
      <h2>{p.kind === 'pharmacy' ? '영업시간' : '진료시간'}</h2>
      {p.hours ? <WeeklyTable hours={p.hours} /> : <div className="skeleton skeleton--table" aria-hidden="true" />}
      {/* 서버가 끝내 못 주면(D51) 화면은 그대로 두고 한 줄로만 알린다 — [전화하기]를 가리지 않는다 */}
      <p className="muted" role="status">
        {failed ? (
          <>
            일부 정보를 불러오지 못했어요.{' '}
            {onRetry ? (
              <button type="button" className="link-btn" onClick={onRetry}>
                다시 시도
              </button>
            ) : null}
          </>
        ) : (
          '나머지 정보를 불러오고 있어요…'
        )}
      </p>
      {p.tel ? <StickyCall tel={p.tel} institutionId={p.id} /> : null}
    </main>
  );
}
