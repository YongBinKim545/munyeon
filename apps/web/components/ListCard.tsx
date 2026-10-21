'use client';

import { describeStatus, parseWeeklyHours, soonLabel, usualLabel, type StatusContext } from '@munyeon/core';
import Link from 'next/link';
import type { ViewItem } from '@/lib/nearby';
import { institutionPath } from '@/lib/seo';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { formatDistance } from './InstitutionCard';

const PAGE = 'home';

/** 메인 목록 카드(D32): 이름·거리 / 배지 / 상태 / [전화하기] [길찾기]. 상태는 브라우저 계산이다. */
export function ListCard({ item, now, ctx }: { item: ViewItem; now: Date; ctx: StatusContext }) {
  return (
    <li className="card" data-id={item.id}>
      <div className="card__head">
        <Link className="card__name" href={institutionPath(item.kind, item.id)}>
          {item.name}
        </Link>
        <span className="muted">{formatDistance(item.distanceM)}</span>
      </div>
      <div className="card__meta">
        <span className="badges">
          <span className="badge">{item.badge}</span>
          {item.pediatric ? <span className="badge">소아 전문</span> : null}
        </span>
      </div>
      <CardStatus item={item} now={now} ctx={ctx} />
      <div className="actions">
        <CallButton tel={item.tel} institutionId={item.id} page={PAGE} compact />
        <DirectionsButton
          institutionId={item.id}
          name={item.name}
          addr={[item.sido, item.sigungu, item.dong].filter(Boolean).join(' ')}
          lat={item.lat}
          lon={item.lon}
          page={PAGE}
          compact
        />
      </div>
    </li>
  );
}

function CardStatus({ item, now, ctx }: { item: ViewItem; now: Date; ctx: StatusContext }) {
  if (item.tier === 'soon' && item.opensAt) {
    return <p className="card__status"><span className="pill pill--soon">{soonLabel(item.opensAt, now)}</span></p>;
  }
  if (item.tier === 'holidayUsual' && item.weekdayLabel) {
    return (
      <p className="card__status">
        <span className="pill pill--holiday">전화 확인 필요</span> <span className="muted">{usualLabel(item.weekdayLabel)}</span>
      </p>
    );
  }
  // '(등록 기준)'은 카드마다 붙이지 않고 목록 맨 위에 한 번(D42)
  const s = describeStatus(parseWeeklyHours(item.hours), now, ctx, { basis: false });
  return <p className="card__status"><span className={`pill pill--${s.tone}`}>{s.text}</span></p>;
}
