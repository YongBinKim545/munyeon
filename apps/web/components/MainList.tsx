'use client';

import type { StatusContext } from '@munyeon/core';
import { useEffect, useRef, useState } from 'react';
import type { ViewItem } from '@/lib/nearby';
import { EmergencyNote } from './EmergencyNote';
import { ListCard } from './ListCard';

/** 한 번에 그리는 카드 수. 끝에 닿으면 이어서 그린다([전체 보기] 뒤 수천 곳 대비). */
export const PAGE_SIZE = 50;

interface Props {
  items: ViewItem[] | null;
  mode: 'open' | 'all';
  now: Date;
  ctx: StatusContext;
  holidayToday: boolean;
  /** 아직 더 받는 중(3km 이상) */
  loadingMore: boolean;
  onShowAll: () => void;
}

/** 메인 목록(D32): 구역 제목 없이 한 줄, 끝에 [전체 보기]. 지역·유형이 바뀌면 부모가 key로 새로 그린다. */
export function MainList({ items, mode, now, ctx, holidayToday, loadingMore, onShowAll }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);

  const total = items?.length ?? 0;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= total || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE_SIZE);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total]);

  if (!items) {
    return (
      <p className="list-loading" role="status">
        가까운 곳을 찾고 있어요…
      </p>
    );
  }

  const shown = items.slice(0, limit);
  return (
    <section aria-label="가까운 곳 목록">
      {holidayToday ? <p className="holiday-strip">오늘은 공휴일 · 공휴일 진료시간 기준</p> : null}
      {total === 0 && mode === 'open' && !loadingMore ? (
        <div className="empty">
          <p>등록 기준으로 지금 문 연 곳이 없어요</p>
          <EmergencyNote />
        </div>
      ) : null}
      <ul className="cards cards--3 main-list">
        {shown.map((item) => (
          <ListCard key={item.id} item={item} now={now} ctx={ctx} />
        ))}
      </ul>
      {limit < total ? (
        <div ref={sentinel} className="list-more">
          <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            더 보기
          </button>
        </div>
      ) : null}
      {loadingMore ? <p className="muted list-loading" role="status">더 찾는 중…</p> : null}
      {mode === 'open' && limit >= total ? (
        <div className="list-more">
          <button type="button" className="btn btn-secondary btn-wide" onClick={onShowAll}>
            전체 보기
          </button>
        </div>
      ) : null}
    </section>
  );
}
