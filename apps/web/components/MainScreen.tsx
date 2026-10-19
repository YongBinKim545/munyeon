'use client';

import { kstParts, type LatLon } from '@munyeon/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { locate, startArea, type AreaSource } from '@/lib/locate';
import { fetchMeta } from '@/lib/meta';
import { areaLabel, buildView, loadNearby, type CellCache, type FetchJson } from '@/lib/nearby';
import type { GridEntry } from '@/lib/grid';
import { pushRecentArea, readKind, readRecentAreas, saveKind, saveLastCenter, type Area } from '@/lib/prefs';
import type { Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { LocationSearchModal } from './LocationSearchModal';
import { MainHeader } from './MainHeader';
import { MainList } from './MainList';
import { ScrollTopButton } from './ScrollTopButton';

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
 * 메인 = 현재 위치 기준 목록(D31·D32·D34·D36). 목록과 지역 이름은 브라우저에서만 그린다.
 * 늦게 온 데이터도 순서 규칙대로 제자리에 넣고, 보고 있는 카드는 화면에서 움직이지 않게 스크롤을 보정한다.
 */
export function MainScreen({ fetchJson }: { fetchJson?: FetchJson }) {
  const [kind, setKind] = useState<Kind>('pharmacy');
  const [mode, setMode] = useState<'open' | 'all'>('open');
  const [recent, setRecent] = useState<Area[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [denied, setDenied] = useState(false);
  const [holidays, setHolidays] = useState<ReadonlySet<string> | null>(null);
  const [data, setData] = useState<{ key: string; entries: GridEntry[]; radiusKm: number; done: boolean } | null>(null);
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

  const startFromLocation = useCallback((manual: boolean) => {
    const req = ++locateReq.current;
    void locate(undefined, (pos) => {
      // 권한 창을 늦게 허용했으면, 그사이 사용자가 지역을 고르지 않은 경우에만 현재 위치로 바꾼다
      if (req === locateReq.current) setCurrent({ center: pos, label: null, source: 'gps' });
    }).then((r) => {
      track(r.ok ? 'locate_ok' : 'locate_fail', null, 'home');
      // 기다리는 사이 사용자가 지역을 골랐으면 그 선택을 덮지 않는다
      if (req !== locateReq.current) return;
      setDenied(!r.ok && r.reason === 'denied');
      if (r.ok) {
        setCurrent({ center: { lat: r.lat, lon: r.lon }, label: null, source: 'gps' });
        setPcNote(window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false);
      } else if (!manual) {
        setCurrent(startArea(r, readRecentAreas()));
      }
    });
  }, []);

  // 처음: 저장된 유형·최근 지역, 공휴일 목록, 현재 위치(D34)
  useEffect(() => {
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다(서버 HTML과 첫 렌더를 맞춘다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind(readKind());
    setRecent(readRecentAreas());
    void fetchMeta().then((m) => setHolidays(new Set(m?.holidays ?? [])));
    startFromLocation(false);
    const tick = () => withAnchor(() => setNow(new Date()));
    const id = setInterval(tick, 60_000);
    // 백그라운드에 있던 탭이 다시 보이면 시각을 바로 갱신한다
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [startFromLocation, withAnchor]);

  // 지역·유형이 바뀌면 1km → 3km → (부족하면 10·25km) 차례로 받는다(D36)
  const centerKey = current ? `${current.center.lat},${current.center.lon}` : '';
  const loadKey = `${centerKey}|${kind}`;
  useEffect(() => {
    if (!current || !holidays) return;
    let alive = true;
    saveLastCenter(current.center);
    void loadNearby({
      kind,
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
  }, [loadKey, holidays, fetchJson, withAnchor]);

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

  const ctx = useMemo(() => ({ holidays: holidays ?? new Set<string>() }), [holidays]);
  const items = useMemo(
    () => (current && view ? buildView(view.entries, current.center, view.radiusKm, now, ctx, mode) : null),
    [current, view, now, ctx, mode],
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

  const pickArea = (a: Area) => {
    locateReq.current += 1;
    setRecent(pushRecentArea(a));
    setDenied(false);
    setCurrent({ center: { lat: a.lat, lon: a.lon }, label: a.label, source: 'manual' });
  };

  return (
    <>
      <MainHeader
        areaLabel={label}
        pcLocationNote={pcNote && current?.source === 'gps'}
        locateDenied={denied}
        recent={recent}
        kind={kind}
        mode={mode}
        onKind={(k) => {
          saveKind(k);
          setKind(k);
        }}
        onMode={setMode}
        onPickArea={pickArea}
        onCurrentLocation={() => startFromLocation(true)}
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
          onShowAll={() => {
            track('show_all', null, 'home');
            setMode('all');
          }}
        />
      </div>
      {modalOpen ? (
        <LocationSearchModal
          onPick={pickArea}
          onClose={() => {
            setModalOpen(false);
            document.getElementById('area-button')?.focus();
          }}
        />
      ) : null}
      <ScrollTopButton />
    </>
  );
}
