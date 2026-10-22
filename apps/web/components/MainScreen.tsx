'use client';

import { kstParts, type LatLon } from '@munyeon/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { geoPermission, locate, startArea, type AreaSource } from '@/lib/locate';
import { fetchMeta } from '@/lib/meta';
import { areaLabel, buildView, kindOf, loadNearby, matcherOf, type CellCache, type FetchJson, type ListFilter } from '@/lib/nearby';
import type { GridEntry } from '@/lib/grid';
import { pushRecentArea, readFilter, readLastArea, readRecentAreas, saveFilter, saveLastArea, saveLastCenter, type Area } from '@/lib/prefs';
import type { Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { LocationGuideModal, type GuideReason } from './LocationGuideModal';
import { LocationSearchModal } from './LocationSearchModal';
import { MainHeader } from './MainHeader';
import { MainList } from './MainList';

interface Current {
  center: LatLon;
  label: string | null;
  source: AreaSource | 'manual';
}

/** 보고 있는 카드(화면 위쪽에 처음 보이는 카드)와 그 화면 위치 */
interface Anchor {
  id: string;
  top: number;
  /** 이 기준을 잡을 때 화면에 있던 목록. 그 목록이 바뀔 때만 보정한다 */
  forItems: unknown;
}

function findAnchor(list: HTMLElement | null, forItems: unknown): Anchor | null {
  if (!list || window.scrollY <= 0) return null; // 맨 위를 보고 있으면 보정하지 않는다
  for (const el of list.querySelectorAll<HTMLElement>('[data-id]')) {
    const top = el.getBoundingClientRect().top;
    if (top >= 0) return { id: el.dataset.id ?? '', top, forItems };
  }
  return null;
}

/**
 * 메인 = 현재 위치 기준 목록(D31·D32·D34·D36·D38·D41). 목록과 지역 이름은 브라우저에서만 그린다.
 * 유형은 약국 / 병원 / 소아과. 목록은 늘 영업 중으로 시작하고 [전체 보기]로 펼친다(유형·지역을 바꾸면 다시 영업 중).
 * 위치 권한은 [현재 위치]를 눌렀을 때만 묻는다. 이미 허용한 브라우저는 들어올 때 자동으로 현재 위치를 쓴다.
 * 늦게 온 데이터도 순서 규칙대로 제자리에 넣고, 보고 있는 카드는 화면에서 움직이지 않게 스크롤을 보정한다.
 */
export function MainScreen({ fetchJson, holidays: initialHolidays = [] }: { fetchJson?: FetchJson; holidays?: string[] }) {
  const [filter, setFilter] = useState<ListFilter>('pharmacy');
  /** [전체 보기]를 누른 목록의 loadKey. 유형·지역을 고르면 지워져 다시 영업 중 목록이 된다 */
  const [showAllKey, setShowAllKey] = useState<string | null>(null);
  const [recent, setRecent] = useState<Area[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [guide, setGuide] = useState<GuideReason | null>(null);
  // 공휴일은 메인 HTML에 담겨 온다(따로 받다가 실패해 평일로 판정하는 일이 없게). /api/meta가 오면 최신 목록으로 바꾼다.
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(() => new Set(initialHolidays));
  const [data, setData] = useState<{ key: string; entries: GridEntry[]; radiusKm: number; done: boolean; failed: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [pcNote, setPcNote] = useState(false);
  const cache = useRef<Record<Kind, CellCache>>({ pharmacy: new Map(), hospital: new Map() });
  const listRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<Anchor | null>(null);
  const shownItems = useRef<unknown>(null);
  /** 위치 요청 번호. 사용자가 지역을 고르거나 다시 요청하면 늘어나, 그 전 요청의 결과는 버린다 */
  const locateReq = useRef(0);

  /** 목록을 바꾸기 직전에 보고 있는 카드를 기억해 둔다 */
  const withAnchor = useCallback((fn: () => void) => {
    anchor.current = findAnchor(listRef.current, shownItems.current);
    fn();
  }, []);

  const applyGps = useCallback((lat: number, lon: number) => {
    setShowAllKey(null);
    setCurrent({ center: { lat, lon }, label: null, source: 'gps' });
    setPcNote(window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false);
  }, []);

  /** [현재 위치]: 아직 정하지 않았으면 브라우저 권한 창, 거부·실패면 안내 모달(D38) */
  const requestLocation = useCallback(() => {
    const req = ++locateReq.current;
    void locate().then((r) => {
      track(r.ok ? 'locate_ok' : 'locate_fail', null, 'home');
      // 기다리는 사이 사용자가 지역을 골랐으면 그 선택을 덮지 않는다
      if (req !== locateReq.current) return;
      if (r.ok) applyGps(r.lat, r.lon);
      else setGuide(r.reason === 'denied' ? 'denied' : 'unavailable');
    });
  }, [applyGps]);

  /** 들어올 때: 이미 허용한 브라우저만 현재 위치(권한 창 없음), 아니면 마지막으로 보던 지역 → 최근 지역 → 명동(D38·D45) */
  const chooseStartArea = useCallback(() => {
    const req = ++locateReq.current;
    const fallback = () => req === locateReq.current && setCurrent(startArea({ ok: false, reason: 'denied' }, readRecentAreas(), readLastArea()));
    void geoPermission().then((state) => {
      if (req !== locateReq.current) return;
      if (state !== 'granted') return fallback();
      void locate().then((r) => {
        if (req !== locateReq.current) return;
        if (r.ok) applyGps(r.lat, r.lon);
        else fallback();
      });
    });
  }, [applyGps]);

  // 처음: 저장된 유형·최근 지역, 공휴일 목록, 시작 지역(D34·D38)
  useEffect(() => {
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다(서버 HTML과 첫 렌더를 맞춘다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilter(readFilter());
    setRecent(readRecentAreas());
    void fetchMeta().then((m) => {
      if (m) setHolidays(new Set(m.holidays)); // 실패하면 HTML에 담겨 온 목록을 그대로 쓴다
    });
    chooseStartArea();
    const tick = () => withAnchor(() => setNow(new Date()));
    const id = setInterval(tick, 60_000);
    // 백그라운드에 있던 탭이 다시 보이면 시각을 바로 갱신한다
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [chooseStartArea, withAnchor]);

  // 지역·유형이 바뀌면 1km → 3km → (부족하면 10·25km) 차례로 받는다(D36)
  const centerKey = current ? `${current.center.lat},${current.center.lon}` : '';
  const kind = kindOf(filter);
  const match = useMemo(() => matcherOf(filter), [filter]);
  const loadKey = `${centerKey}|${filter}`;
  const mode = showAllKey === loadKey ? 'all' : 'open';
  useEffect(() => {
    if (!current) return;
    let alive = true;
    saveLastCenter(current.center);
    void loadNearby({
      kind,
      match,
      center: current.center,
      at: () => new Date(),
      ctx: { holidays },
      cache: cache.current[kind],
      fetchJson,
      isCurrent: () => alive,
      onStep: (s) => withAnchor(() => setData({ key: loadKey, ...s })),
    });
    return () => {
      alive = false;
    };
    // centerKey가 center를 대신한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, holidays, fetchJson, withAnchor, retry]);

  // 지역·유형이 바뀌면 새 목록을 맨 위에서 보여준다
  const prevLoadKey = useRef(loadKey);
  useEffect(() => {
    if (prevLoadKey.current !== loadKey && current) window.scrollTo(0, 0);
    prevLoadKey.current = loadKey;
  }, [loadKey, current]);

  // 지금 지역·유형의 데이터만 쓴다(바뀐 직후에는 '찾는 중')
  const view = data?.key === loadKey ? data : null;
  // 현재 위치의 지역 이름은 받은 데이터에서 가장 가까운 기관으로 붙인다(외부 주소 API 없음)
  const label = useMemo(
    () => current?.label ?? (current && view?.entries.length ? areaLabel(current.center, view.entries) : null),
    [current, view],
  );
  // 이름이 정해진 지역은 마지막으로 보던 지역으로 저장해, 새로고침하면 여기서 시작한다(D45).
  // 기본값(명동)은 사용자가 고른 곳이 아니라 저장하지 않는다(최근 지역이 있으면 그쪽이 먼저).
  useEffect(() => {
    if (current && label && current.source !== 'default') saveLastArea({ label, lat: current.center.lat, lon: current.center.lon });
  }, [current, label]);

  const ctx = useMemo(() => ({ holidays }), [holidays]);
  const items = useMemo(
    () => (current && view ? buildView(match ? view.entries.filter(match) : view.entries, current.center, view.radiusKm, now, ctx, mode) : null),
    [current, view, now, ctx, mode, match],
  );

  // 보던 카드의 화면 위치가 그대로 남도록 스크롤을 보정한다(사파리는 자동 보정이 없다)
  useLayoutEffect(() => {
    const a = anchor.current;
    const prev = shownItems.current;
    anchor.current = null;
    shownItems.current = items;
    if (!a || a.forItems !== prev || !listRef.current) return;
    const el = [...listRef.current.querySelectorAll<HTMLElement>('[data-id]')].find((x) => x.dataset.id === a.id);
    if (!el) return;
    const diff = el.getBoundingClientRect().top - a.top;
    if (diff !== 0) window.scrollBy(0, diff);
  }, [items]);

  const chooseFilter = (f: ListFilter) => {
    saveFilter(f);
    setShowAllKey(null);
    setFilter(f);
  };

  const pickArea = (a: Area) => {
    locateReq.current += 1;
    setRecent(pushRecentArea(a));
    setShowAllKey(null);
    setCurrent({ center: { lat: a.lat, lon: a.lon }, label: a.label, source: 'manual' });
  };

  return (
    <>
      <MainHeader
        areaLabel={label}
        pcLocationNote={pcNote && current?.source === 'gps'}
        filter={filter}
        onFilter={chooseFilter}
        onCurrentLocation={requestLocation}
        onOpenLocationSearch={() => setModalOpen(true)}
      />
      <div ref={listRef}>
        <MainList
          items={items}
          mode={mode}
          now={now}
          ctx={ctx}
          holidayToday={ctx.holidays.has(kstParts(now).ymd)}
          key={loadKey}
          loadingMore={!!view && !view.done}
          failed={!!view && view.failed > 0}
          onRetry={() => setRetry((n) => n + 1)}
          onShowAll={() => {
            track('show_all', null, 'home');
            setShowAllKey(loadKey);
          }}
          filter={filter}
          onNearbyHospitals={() => chooseFilter('hospital')}
        />
      </div>
      {modalOpen ? (
        <LocationSearchModal
          recent={recent}
          onPick={pickArea}
          onClose={() => {
            setModalOpen(false);
            document.getElementById('area-button')?.focus();
          }}
        />
      ) : null}
      {guide ? (
        <LocationGuideModal
          reason={guide}
          onClosed={(action) => {
            setGuide(null);
            if (action === 'retry') requestLocation();
            else if (action === 'search') setModalOpen(true);
            else document.getElementById('area-button')?.focus();
          }}
        />
      ) : null}
    </>
  );
}
