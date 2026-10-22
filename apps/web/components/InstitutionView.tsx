import type { InstitutionRecord } from '@munyeon/db';
import { buildInstitutionJsonLd, serializeJsonLd } from '@/lib/jsonld';
import { KIND_LABEL, regionPath } from '@/lib/seo';
import { Badges } from './Badges';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { CallButton } from './CallButton';
import { CorrectionButton } from './CorrectionButton';
import { DataStamp } from './DataStamp';
import { DetailReady } from './DetailReady';
import { DirectionsButton } from './DirectionsButton';
import { EmergencyNote } from './EmergencyNote';
import { LiveStatus } from './LiveStatus';
import { StickyCall } from './StickyCall';
import { WeeklyTable } from './WeeklyTable';

interface Props {
  rec: InstitutionRecord;
  holidays: string[];
  lastSyncAt: Date | null;
  url: string;
}

/**
 * 기관 상세(기능 정의서 4.1). 서버 컴포넌트이며 현재 상태는 LiveStatus만 계산한다.
 * 근처 기관 구역은 처음 여는 속도를 위해 뺐다(D51). 다른 곳은 상단 경로의 지역 페이지·메인에서 찾는다.
 */
export function InstitutionView({ rec, holidays, lastSyncAt, url }: Props) {
  const crumbs: Crumb[] = [];
  if (rec.sido) crumbs.push({ name: rec.sido, href: regionPath(rec.sido) });
  if (rec.sido && rec.sigungu) {
    crumbs.push({ name: rec.sigungu, href: regionPath(rec.sido, rec.sigungu) });
    crumbs.push({ name: KIND_LABEL[rec.kind], href: regionPath(rec.sido, rec.sigungu, rec.kind, 'all') });
  }
  crumbs.push({ name: rec.name, href: url.replace(/^https?:\/\/[^/]+/, '') });

  const header = (
    <>
      <Breadcrumbs items={crumbs} />
      <h1>{rec.name}</h1>
      <p>
        <Badges kind={rec.kind} category={rec.category} divName={rec.divName} specialty={rec.specialty} pediatricName={rec.pediatricName} />
      </p>
      <p className="muted">{rec.addr}</p>
      <DetailReady />
    </>
  );

  if (!rec.isActive) {
    return (
      <main className="container">
        {header}
        <p className="notice">현재 운영 정보가 없습니다. 폐업했거나 정보가 바뀌었을 수 있어요. 위 지역 목록에서 다른 {KIND_LABEL[rec.kind]}을 찾아보세요.</p>
        <CorrectionButton kind={rec.kind} institutionId={rec.id} name={rec.name} />
        <EmergencyNote />
      </main>
    );
  }

  const actions = (
    <div className="actions detail-call">
      <CallButton tel={rec.tel} institutionId={rec.id} page="detail" />
      <DirectionsButton institutionId={rec.id} name={rec.name} addr={rec.addr} lat={rec.lat} lon={rec.lon} page="detail" />
    </div>
  );

  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildInstitutionJsonLd(rec, url)) }} />
      {header}
      <LiveStatus hours={rec.hours} holidays={holidays} />
      {actions}
      <p className="notice">
        등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.
        {lastSyncAt ? (
          <>
            <br />
            <DataStamp kind={rec.kind} initial={lastSyncAt.toISOString()} />
          </>
        ) : null}
      </p>
      {/* 틀린 정보를 알려 주는 버튼(D49) */}
      <CorrectionButton kind={rec.kind} institutionId={rec.id} name={rec.name} />
      <h2>{rec.kind === 'pharmacy' ? '영업시간' : '진료시간'}</h2>
      <WeeklyTable hours={rec.hours} />
      <EmergencyNote />
      <p className="muted">출처: 국립중앙의료원 · 공공데이터포털</p>
      {rec.tel ? <StickyCall tel={rec.tel} institutionId={rec.id} /> : null}
    </main>
  );
}
