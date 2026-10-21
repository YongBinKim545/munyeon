'use client';

import type { StatusContext } from '@munyeon/core';
import { useEffect, useRef, useState } from 'react';
import { MIN_VISIBLE, type ListFilter, type ViewItem } from '@/lib/nearby';
import { EmergencyNote } from './EmergencyNote';
import { ListCard } from './ListCard';

/** 처음 그리는 카드 수이자 [더 보기] 한 번에 늘리는 수(D45). 자동으로 이어 붙이지 않아 아래 지역 링크에 닿을 수 있다. */
export const PAGE_SIZE = 10;

interface Props {
  items: ViewItem[] | null;
  mode: 'open' | 'all';
  now: Date;
  ctx: StatusContext;
  holidayToday: boolean;
  /** 아직 더 받는 중(3km 이상) */
  loadingMore: boolean;
  onShowAll: () => void;
  /** 받지 못한 칸이 있음(있으면 안내와 [다시 시도]) */
  failed: boolean;
  onRetry: () => void;
  /** 소아과면 문구가 바뀌고, 영업 중인 곳이 적을 때 [가까운 병원 보기](D41) */
  filter?: ListFilter;
  onNearbyHospitals?: () => void;
}

/** 메인 목록(D32): 구역 제목 없이 한 줄, 끝에 [전체 보기]. 지역·유형이 바뀌면 부모가 key로 새로 그린다. */
export function MainList({ items, mode, now, ctx, holidayToday, loadingMore, onShowAll, failed, onRetry, filter, onNearbyHospitals }: Props) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  /** [더 보기]로 새로 나온 첫 카드. 그 카드의 이름 링크로 포커스를 옮긴다 */
  const focusFrom = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const total = items?.length ?? 0;
  useEffect(() => {
    const from = focusFrom.current;
    if (from === null) return;
    focusFrom.current = null;
    listRef.current?.querySelectorAll<HTMLElement>('[data-id] .card__name')[from]?.focus();
  }, [limit]);

  if (!items) {
    return (
      <p className="list-loading" role="status">
        가까운 곳을 찾고 있어요…
      </p>
    );
  }

  // 하나도 받지 못했으면 '문 연 곳 없음'이 아니라 불러오기 실패로 알린다
  if (failed && total === 0) {
    return (
      <div className="load-error" role="alert">
        <p>목록을 불러오지 못했어요</p>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }

  const shown = items.slice(0, limit);
  const pediatric = filter === 'pediatric';
  // 다 넓힌 뒤에도(25km) 소아과 영업 중(영업 중·곧 영업·전화 확인 필요)이 적으면 병원으로 넘어갈 수 있게 한다
  const openCount = items.filter((i) => i.tier !== 'closed' && i.tier !== 'unknown').length;
  const fewPediatric = pediatric && !loadingMore && !failed && openCount < MIN_VISIBLE && !!onNearbyHospitals;
  return (
    <section aria-label="가까운 곳 목록">
      {failed ? (
        <div className="load-error load-error--partial" role="alert">
          <p>일부를 불러오지 못했어요</p>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : null}
      {holidayToday ? <p className="holiday-strip">오늘은 공휴일 · 공휴일 진료시간 기준</p> : null}
      {total > 0 ? <p className="muted list-basis">영업시간은 등록 기준이에요 · 방문 전 전화로 확인하세요</p> : null}
      {total === 0 && mode === 'open' && !loadingMore ? (
        <div className="empty">
          <p>{pediatric ? '등록 기준으로 지금 문 연 소아과가 없어요' : '등록 기준으로 지금 문 연 곳이 없어요'}</p>
          <EmergencyNote />
        </div>
      ) : null}
      <ul ref={listRef} className="cards cards--3 main-list">
        {shown.map((item) => (
          <ListCard key={item.id} item={item} now={now} ctx={ctx} />
        ))}
      </ul>
      {limit < total ? (
        <div className="list-more">
          <button
            type="button"
            className="btn btn-secondary btn-wide"
            onClick={() => {
              focusFrom.current = limit;
              setLimit((l) => l + PAGE_SIZE);
            }}
          >
            {Math.min(PAGE_SIZE, total - limit)}곳 더 보기 (남은 {total - limit}곳)
          </button>
        </div>
      ) : null}
      {loadingMore ? <p className="muted list-loading" role="status">더 찾는 중…</p> : null}
      {fewPediatric && limit >= total ? (
        <div className="list-more list-switch">
          <p className="muted">가까운 곳에 지금 문 연 소아과가 적어요</p>
          <button type="button" className="btn btn-secondary btn-wide" onClick={onNearbyHospitals}>
            가까운 병원 보기
          </button>
        </div>
      ) : null}
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
