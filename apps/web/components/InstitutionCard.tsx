import type { InstitutionSummary } from '@munyeon/db';
import Link from 'next/link';
import { institutionPath } from '@/lib/seo';
import { Badges } from './Badges';
import { CallButton } from './CallButton';

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
      </div>
    </li>
  );
}
