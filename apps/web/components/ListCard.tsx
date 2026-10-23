'use client';

import { dateLabel, dayLabel, describeStatus, parseWeeklyHours, soonLabel, usualLabel, type StatusContext } from '@munyeon/core';
import { formatArea, type ViewItem } from '@/lib/nearby';
import { NOW, type When } from '@/lib/when';
import { CallButton } from './CallButton';
import { DirectionsButton } from './DirectionsButton';
import { formatDistance } from './InstitutionCard';
import { PreviewLink } from './PreviewLink';

/** 메인 목록 카드(D32): 이름·거리 / 배지 / 상태 / [전화하기] [길찾기]. 상태는 브라우저 계산이다. */
export function ListCard({ item, now, ctx, when = NOW, page = 'home' }: { item: ViewItem; now: Date; ctx: StatusContext; when?: When; page?: string }) {
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
      {when.kind === 'date' ? <DayStatus item={item} ymd={when.ymd} /> : <CardStatus item={item} now={now} ctx={ctx} />}
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

/** 날짜를 고른 목록: '10/25(일) 09:00~18:00' / 공휴일 '전화 확인 필요 · 평소 금요일 09:00~18:00' / '그날 정보 없음' */
function DayStatus({ item, ymd }: { item: ViewItem; ymd: string }) {
  if (item.tier === 'open' && item.range) {
    return <p className="card__status"><span className="pill pill--open">{dateLabel(ymd)} {dayLabel(item.range)}</span></p>;
  }
  if (item.tier === 'holidayUsual' && item.range) {
    return (
      <p className="card__status">
        <span className="pill pill--holiday">전화 확인 필요</span> <span className="muted">평소 {item.weekdayLabel} {dayLabel(item.range)}</span>
      </p>
    );
  }
  return <p className="card__status"><span className="pill pill--unknown">{dateLabel(ymd)} 정보 없음 — 전화로 확인</span></p>;
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
  const s = describeStatus(parseWeeklyHours(item.hours), now, ctx);
  return <p className="card__status"><span className={`pill pill--${s.tone}`}>{s.text}</span></p>;
}
