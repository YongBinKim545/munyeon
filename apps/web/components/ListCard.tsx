'use client';

import { describeStatus, parseWeeklyHours, soonLabel, usualLabel, type StatusContext } from '@munyeon/core';
import { formatArea, type ViewItem } from '@/lib/nearby';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { formatDistance } from './InstitutionCard';
import { PreviewLink } from './PreviewLink';

/** 메인 목록 카드(D32): 이름·거리 / 배지 / 상태 / [전화하기] [길찾기]. 상태는 브라우저 계산이다. */
export function ListCard({ item, now, ctx, page = 'home' }: { item: ViewItem; now: Date; ctx: StatusContext; page?: string }) {
  return (
    <li className="card" data-id={item.id}>
      <div className="card__head">
        {/* 누르는 즉시 이 카드의 정보로 상세를 그린다(D45·D51) */}
        <PreviewLink
          className="card__name"
          preview={{
            kind: item.kind, id: item.id, name: item.name, badge: item.badge, pediatric: item.pediatric, tel: item.tel,
            hours: item.hours, sido: item.sido, sigungu: item.sigungu, area: formatArea(item.sido, item.sigungu, item.dong),
            lat: item.lat, lon: item.lon, holidays: [...ctx.holidays],
          }}
        >
          {item.name}
        </PreviewLink>
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
        <CallButton tel={item.tel} institutionId={item.id} page={page} compact />
        <DirectionsButton
          institutionId={item.id}
          name={item.name}
          addr={[item.sido, item.sigungu, item.dong].filter(Boolean).join(' ')}
          lat={item.lat}
          lon={item.lon}
          page={page}
          compact
        />
      </div>
    </li>
  );
}

function CardStatus({ item, now, ctx }: { item: ViewItem; now: Date; ctx: StatusContext }) {
  // 응급실 목록은 외래 진료시간으로 판정하지 않는다(D78)
  if (item.emergency) return <p className="card__status"><span className="pill pill--open">응급실 24시간</span></p>;
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
  const s = describeStatus(parseWeeklyHours(item.hours), now, ctx);
  return <p className="card__status"><span className={`pill pill--${s.tone}`}>{s.text}</span></p>;
}
