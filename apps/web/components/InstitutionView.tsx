import { DAY_LABELS, formatRange, parseWeeklyHours } from '@munyeon/core';
import type { InstitutionRecord, InstitutionSummary } from '@munyeon/db';
import { buildInstitutionJsonLd } from '@/lib/jsonld';
import { KIND_LABEL, regionPath } from '@/lib/seo';
import { Badges } from './Badges';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { EmergencyNote } from './EmergencyNote';
import { InstitutionCard } from './InstitutionCard';
import { LiveStatus } from './LiveStatus';
import { WeeklyTable } from './WeeklyTable';

interface Props {
  rec: InstitutionRecord;
  nearby: InstitutionSummary[];
  holidays: string[];
  lastSyncAt: Date | null;
  url: string;
}

/** 'YYYY-MM-DD HH:mm' (KST) */
export function formatKst(d: Date): string {
  return new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
}

/** 근처 기관 카드의 한 줄 정보: 일요일·공휴일 운영 여부 */
function weekendMeta(item: InstitutionSummary): string {
  const w = parseWeeklyHours(item.hours);
  return `${DAY_LABELS[7]} ${formatRange(w[7])} · ${DAY_LABELS[8]} ${formatRange(w[8])}`;
}

/** 기관 상세(기능 정의서 4.1). 서버 컴포넌트이며 현재 상태는 LiveStatus만 계산한다. */
export function InstitutionView({ rec, nearby, holidays, lastSyncAt, url }: Props) {
  const crumbs: Crumb[] = [];
  if (rec.sido) crumbs.push({ name: rec.sido, href: regionPath(rec.sido) });
  if (rec.sido && rec.sigungu) {
    crumbs.push({ name: rec.sigungu, href: regionPath(rec.sido, rec.sigungu) });
    crumbs.push({ name: KIND_LABEL[rec.kind], href: regionPath(rec.sido, rec.sigungu, rec.kind, 'all') });
  }
  crumbs.push({ name: rec.name, href: url.replace(/^https?:\/\/[^/]+/, '') });

  const nearbySection =
    rec.hasGeom && nearby.length > 0 ? (
      <section>
        <h2>근처 {KIND_LABEL[rec.kind]}</h2>
        <ul className="cards">
          {nearby.map((n) => (
            <InstitutionCard key={n.id} item={n} page="detail_nearby" meta={weekendMeta(n)} />
          ))}
        </ul>
      </section>
    ) : null;

  const header = (
    <>
      <Breadcrumbs items={crumbs} />
      <h1>{rec.name}</h1>
      <p>
        <Badges kind={rec.kind} category={rec.category} divName={rec.divName} specialty={rec.specialty} pediatricName={rec.pediatricName} />
      </p>
      <p className="muted">{rec.addr}</p>
    </>
  );

  if (!rec.isActive) {
    return (
      <main className="container">
        {header}
        <p className="notice">현재 운영 정보가 없습니다. 폐업했거나 정보가 바뀌었을 수 있어요. 근처 {KIND_LABEL[rec.kind]}을 확인하세요.</p>
        {nearbySection}
        <EmergencyNote />
      </main>
    );
  }

  const actions = (
    <div className="actions">
      <CallButton tel={rec.tel} institutionId={rec.id} page="detail" />
      <DirectionsButton institutionId={rec.id} name={rec.name} addr={rec.addr} lat={rec.lat} lon={rec.lon} page="detail" />
    </div>
  );

  return (
    <main className="container container--wide">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildInstitutionJsonLd(rec, url)) }} />
      <div className="detail-grid">
        <div className="detail-main">
          {header}
          <LiveStatus hours={rec.hours} holidays={holidays} />
          <div className="hide-pc">{actions}</div>
          <p className="notice">
            등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.
            {lastSyncAt ? (
              <>
                <br />
                {`데이터 기준: ${formatKst(lastSyncAt)}`}
              </>
            ) : null}
          </p>
          {!rec.tel ? nearbySection : null}
          <h2>{rec.kind === 'pharmacy' ? '영업시간' : '진료시간'}</h2>
          <WeeklyTable hours={rec.hours} />
          {rec.tel ? nearbySection : null}
          <EmergencyNote />
          <p className="muted">출처: 국립중앙의료원 · 공공데이터포털</p>
        </div>
        <aside className="detail-aside show-pc" aria-label="전화·길찾기">
          {actions}
        </aside>
      </div>
      {rec.tel ? (
        <div className="sticky-call">
          <CallButton tel={rec.tel} institutionId={rec.id} page="detail_sticky" />
        </div>
      ) : null}
    </main>
  );
}
