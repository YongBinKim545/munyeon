import { primaryBadge } from '@munyeon/core';
import type { InstitutionSummary } from '@munyeon/db';
import { Badges } from './Badges';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { PreviewLink } from './PreviewLink';

interface Props {
  item: InstitutionSummary;
  page: string;
  /** 거리·동·해당 상황의 시간 같은 한 줄 정보 */
  meta?: string;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

export function InstitutionCard({ item, page, meta }: Props) {
  return (
    <li className="card">
      <div className="card__head">
        {/* 누르는 즉시 이 카드의 정보로 상세를 그린다(D51) */}
        <PreviewLink
          className="card__name"
          preview={{
            kind: item.kind, id: item.id, name: item.name,
            badge: primaryBadge({ kind: item.kind, category: item.category, divName: item.divName, specialty: item.specialty }),
            pediatric: item.pediatricName, tel: item.tel, hours: item.hours, sido: null, sigungu: null, area: item.addr,
            lat: item.lat, lon: item.lon, holidays: [],
          }}
        >
          {item.name}
        </PreviewLink>
        {item.distanceM !== undefined ? <span className="muted">{formatDistance(item.distanceM)}</span> : null}
      </div>
      <div className="card__meta">
        <Badges kind={item.kind} category={item.category} divName={item.divName} specialty={item.specialty} pediatricName={item.pediatricName} />
        {meta ? <span> · {meta}</span> : null}
      </div>
      <div className="actions">
        <CallButton tel={item.tel} institutionId={item.id} page={page} compact />
        {/* 메인 카드처럼 [전화하기] 옆에 [길찾기](D43) */}
        <DirectionsButton institutionId={item.id} name={item.name} addr={item.addr} lat={item.lat} lon={item.lon} page={page} compact />
      </div>
    </li>
  );
}
