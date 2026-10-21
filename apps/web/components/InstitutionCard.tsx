import type { InstitutionSummary } from '@munyeon/db';
import Link from 'next/link';
import { institutionPath } from '@/lib/seo';
import { Badges } from './Badges';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';

interface Props {
  item: InstitutionSummary;
  page: string;
  /** 거리·동·해당 상황의 시간 같은 한 줄 정보 */
  meta?: string;
  /** 동 우선 정렬(DongFocus)용 */
  dong?: string | null;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

export function InstitutionCard({ item, page, meta, dong }: Props) {
  return (
    <li className="card" data-dong={dong ?? undefined}>
      <div className="card__head">
        <Link className="card__name" href={institutionPath(item.kind, item.id)}>
          {item.name}
        </Link>
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
