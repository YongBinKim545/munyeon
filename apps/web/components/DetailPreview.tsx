'use client';

import type { DetailPreview as Preview } from '@/lib/detailPreview';
import { KIND_LABEL } from '@/lib/seo';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { LiveStatus } from './LiveStatus';
import { WeeklyTable } from './WeeklyTable';

/**
 * 서버 상세 페이지가 오기 전에, 메인 목록·이름 검색이 가진 정보로 즉시 그리는 상세(D45).
 * 기관 상세(InstitutionView)와 같은 배치·부품을 써서, 서버 페이지로 바뀔 때 화면이 덜 움직이게 한다.
 */
export function DetailPreview({ p }: { p: Preview }) {
  const crumbs = ['홈', p.sido, p.sigungu, p.sido && p.sigungu ? KIND_LABEL[p.kind] : null, p.name].filter(Boolean);
  const actions = (
    <div className="actions">
      <CallButton tel={p.tel} institutionId={p.id} page="detail" />
      <DirectionsButton institutionId={p.id} name={p.name} addr={p.area} lat={p.lat} lon={p.lon} page="detail" />
    </div>
  );
  return (
    <main className="container container--wide" aria-busy="true">
      <div className="detail-grid">
        <div className="detail-main">
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
          <div className="hide-pc">{actions}</div>
          <p className="notice">등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.</p>
          <h2>{p.kind === 'pharmacy' ? '영업시간' : '진료시간'}</h2>
          {p.hours ? <WeeklyTable hours={p.hours} /> : <div className="skeleton skeleton--table" aria-hidden="true" />}
          <p className="muted" role="status">
            나머지 정보를 불러오고 있어요…
          </p>
        </div>
        <aside className="detail-aside show-pc" aria-label="전화·길찾기">
          {actions}
        </aside>
      </div>
      {p.tel ? (
        <div className="sticky-call">
          <CallButton tel={p.tel} institutionId={p.id} page="detail_sticky" />
        </div>
      ) : null}
    </main>
  );
}
