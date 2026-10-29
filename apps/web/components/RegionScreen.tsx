'use client';

import { kstParts, type LatLon } from '@munyeon/core';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { decodeGrid, type GridEntry } from '@/lib/grid';
import { geoPermission } from '@/lib/locate';
import { fetchMeta } from '@/lib/meta';
import {
  buildEmergencyView, buildView, defaultFetchJson, FILTER_LABEL, HOSPITAL_FILTERS, loadEmergency, matcherOf,
  type FetchJson, type HospitalFilter, type ListFilter,
} from '@/lib/nearby';
import { clearViewArea, pushRecentArea, saveFilter, saveLastArea, saveViewArea, type Area } from '@/lib/prefs';
import type { Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { LocationSearchModal } from './LocationSearchModal';
import { FilterBar } from './FilterBar';
import { MainList } from './MainList';

/** 시군구 안 전부를 한 번에 본다(메인처럼 반경을 넓히지 않는다) */
const WHOLE_REGION_KM = 1000;
/** 병원 화면의 진료과 주소(#소아과·#산부인과·#치과·#응급실, D78). 서버는 읽지 않는다(캐시가 갈라지지 않게) */
const hashOf = (f: ListFilter) => (f === 'pharmacy' || f === 'hospital' ? '' : `#${FILTER_LABEL[f]}`);
const filterOfHash = (hash: string): HospitalFilter | null =>
  HOSPITAL_FILTERS.find((f) => f !== 'hospital' && hashOf(f) === decodeURIComponent(hash)) ?? null;

interface Props {
  sido: string;
  sigungu: string;
  kind: Kind;
  /** 시군구 기관 좌표의 가운데값(서버가 계산해 넣는다) */
  center: LatLon | null;
  holidays: string[];
  /** 약국 화면·병원 화면 주소 */
  paths: Record<Kind, string>;
  fetchJson?: FetchJson;
}

/**
 * 지역 화면(D69): 메인과 같은 목록에 지역만 시군구로 고정. 거리는 그 시군구 중심 기준이고 위치는 묻지 않는다(D56).
 * 목록·상태는 브라우저에서만 그린다(D23). 목록 데이터는 페이지에 넣지 않고 /api/region에서 받는다(D80: 페이지가 수백 KB가 되어
 * Vercel ISR 쓰기·DB 전송량을 키웠다). 서버 HTML의 검색엔진용 목록은 페이지가 따로 둔다.
 * 응급실은 전국 응급실 목록에서 시군구 중심에 가까운 순(D78).
 */
export function RegionScreen({ sido, sigungu, kind, center, holidays: initialHolidays, paths, fetchJson = defaultFetchJson }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<ListFilter>(kind);
  const [emergency, setEmergency] = useState<GridEntry[] | null>(null);
  /** 이 시군구 기관(받기 전 null). failed면 [다시 시도] */
  const [list, setList] = useState<{ entries: GridEntry[]; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(() => new Set(initialHolidays));
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // 진료과는 병원 화면의 #소아과·#산부인과·#응급실
    const fromHash = kind === 'hospital' ? filterOfHash(window.location.hash) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromHash) setFilter(fromHash);
    setMounted(true);
    void fetchMeta().then((m) => {
      if (m) setHolidays(new Set(m.holidays));
    });
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [kind]);

  // 응급실을 고르면 전국 응급실 목록을 받는다(실패하면 빈 목록)
  useEffect(() => {
    if (filter !== 'emergency' || emergency) return;
    let alive = true;
    void loadEmergency()
      .catch(() => [])
      .then((list) => alive && setEmergency(list));
    return () => {
      alive = false;
    };
  }, [filter, emergency]);

  useEffect(() => {
    let alive = true;
    const url = `/api/region/${kind}?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`;
    fetchJson(url)
      .then((p) => alive && setList({ entries: decodeGrid(p, kind), failed: false }))
      .catch(() => alive && setList({ entries: [], failed: true }));
    return () => {
      alive = false;
    };
  }, [kind, sido, sigungu, fetchJson, retry]);

  const entries = list?.entries;
  const ctx = useMemo(() => ({ holidays }), [holidays]);
  const match = useMemo(() => matcherOf(filter), [filter]);
  const items = useMemo(
    () =>
      !mounted || !center
        ? null
        : filter === 'emergency'
          ? emergency && buildEmergencyView(emergency, center)
          : entries ? buildView(match ? entries.filter(match) : entries, center, WHOLE_REGION_KM, now, ctx, showAll ? 'all' : 'open') : null,
    [mounted, center, entries, match, now, ctx, showAll, filter, emergency],
  );

  const chooseFilter = (f: ListFilter) => {
    saveFilter(f);
    setShowAll(false);
    const target = f === 'pharmacy' ? 'pharmacy' : 'hospital';
    if (target !== kind) return router.push(paths[target] + hashOf(f));
    setFilter(f);
    // 고른 진료과를 주소에 담아 그대로 공유할 수 있게 한다(새 기록은 남기지 않는다)
    const url = new URL(window.location.href);
    url.hash = hashOf(f);
    window.history.replaceState(window.history.state, '', url);
  };

  /** [내 동네 기준으로 보기](D56): 위치를 이미 허용했으면 메인(현재 위치), 아니면 이 시군구의 동을 골라 메인으로 */
  const toMyArea = () => {
    void geoPermission().then((state) => {
      if (state === 'granted') {
        clearViewArea(); // 이 탭에서 보던 다른 지역이 아니라 현재 위치로(D73)
        router.push('/');
      }
      else setModalOpen(true);
    });
  };

  const pickArea = (a: Area) => {
    pushRecentArea(a);
    saveLastArea(a); // 고른 동을 마지막 지역으로 기억해 메인이 여기서 시작한다(D45·D56)
    saveViewArea({ ...a, gps: false });
    router.push('/');
  };

  return (
    <>
      <div className="region-header">
        <FilterBar filter={filter} onFilter={chooseFilter} />
      </div>
      <p className="muted list-basis">
        {center ? `거리는 ${sigungu} 중심 기준이에요 · ` : null}
        <button type="button" className="link-btn" onClick={toMyArea}>
          내 동네 기준으로 보기
        </button>
      </p>
      {mounted ? (
        <MainList
          key={filter}
          items={items}
          mode={showAll ? 'all' : 'open'}
          now={now}
          ctx={ctx}
          holidayToday={ctx.holidays.has(kstParts(now).ymd)}
          loadingMore={false}
          failed={filter !== 'emergency' && !!list?.failed}
          onRetry={() => {
            setList(null);
            setRetry((n) => n + 1);
          }}
          onShowAll={() => {
            track('show_all', null, 'region');
            setShowAll(true);
          }}
          filter={filter}
          onNearbyHospitals={() => chooseFilter('hospital')}
          page="region"
        />
      ) : (
        <p className="list-loading" role="status">
          목록을 준비하고 있어요…
        </p>
      )}
      {modalOpen ? (
        <LocationSearchModal recent={[]} scope={{ sido, sigungu }} onPick={pickArea} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  );
}
