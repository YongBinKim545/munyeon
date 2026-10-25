'use client';

import { kstParts, type LatLon } from '@munyeon/core';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { decodeGrid, type GridPayload } from '@/lib/grid';
import { geoPermission } from '@/lib/locate';
import { fetchMeta } from '@/lib/meta';
import { buildView, matcherOf, type ListFilter } from '@/lib/nearby';
import { pushRecentArea, saveFilter, saveLastArea, savePickedArea, type Area } from '@/lib/prefs';
import type { Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { NOW, parseWhen, readWhen, saveWhen, type When } from '@/lib/when';
import { LocationSearchModal } from './LocationSearchModal';
import { MainList } from './MainList';
import { WhenSelect } from './WhenSelect';

/** 시군구 안 전부를 한 번에 본다(메인처럼 반경을 넓히지 않는다) */
const WHOLE_REGION_KM = 1000;
/** 공유 링크에 담는 날짜(D69). 서버는 읽지 않고(캐시가 갈라지지 않게) 브라우저만 읽는다 */
const DATE_PARAM = '날짜';
const PEDIATRIC_HASH = '#소아과';

interface Props {
  sido: string;
  sigungu: string;
  kind: Kind;
  payload: GridPayload;
  center: LatLon | null;
  holidays: string[];
  /** 약국 화면·병원 화면 주소 */
  paths: Record<Kind, string>;
}

/**
 * 지역 화면(D69): 메인과 같은 목록에 지역만 시군구로 고정. 거리는 그 시군구 중심 기준이고 위치는 묻지 않는다(D56).
 * 목록·상태는 브라우저에서만 그린다(D23). 서버 HTML의 검색엔진용 목록은 페이지가 따로 둔다(RegionDirectory).
 */
export function RegionScreen({ sido, sigungu, kind, payload, center, holidays: initialHolidays, paths }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<ListFilter>(kind);
  const [when, setWhen] = useState<When>(NOW);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(() => new Set(initialHolidays));
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // 주소의 ?날짜=(공유 링크)가 먼저, 없으면 이 방문에서 고른 날짜. 소아과는 병원 화면의 #소아과
    const at = new Date();
    const fromUrl = new URLSearchParams(window.location.search).get(DATE_PARAM);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWhen(fromUrl ? parseWhen(fromUrl, at) : readWhen(at));
    if (kind === 'hospital' && decodeURIComponent(window.location.hash) === PEDIATRIC_HASH) setFilter('pediatric');
    setMounted(true);
    void fetchMeta().then((m) => {
      if (m) setHolidays(new Set(m.holidays));
    });
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [kind]);

  const entries = useMemo(() => decodeGrid(payload, kind), [payload, kind]);
  const ctx = useMemo(() => ({ holidays }), [holidays]);
  const match = useMemo(() => matcherOf(filter), [filter]);
  const items = useMemo(
    () => (mounted && center ? buildView(match ? entries.filter(match) : entries, center, WHOLE_REGION_KM, now, ctx, showAll ? 'all' : 'open', when) : null),
    [mounted, center, entries, match, now, ctx, showAll, when],
  );

  const chooseFilter = (f: ListFilter) => {
    saveFilter(f);
    setShowAll(false);
    const target = f === 'pharmacy' ? 'pharmacy' : 'hospital';
    if (target !== kind) router.push(paths[target] + (f === 'pediatric' ? PEDIATRIC_HASH : ''));
    else setFilter(f);
  };

  const chooseWhen = (w: When) => {
    saveWhen(w);
    setShowAll(false);
    setWhen(w);
    // 고른 날짜를 주소에 담아 그대로 공유할 수 있게 한다(새 기록은 남기지 않는다)
    const url = new URL(window.location.href);
    if (w.kind === 'date') url.searchParams.set(DATE_PARAM, w.ymd);
    else url.searchParams.delete(DATE_PARAM);
    window.history.replaceState(window.history.state, '', url);
  };

  /** [내 동네 기준으로 보기](D56): 위치를 이미 허용했으면 메인(현재 위치), 아니면 이 시군구의 동을 골라 메인으로 */
  const toMyArea = () => {
    void geoPermission().then((state) => {
      if (state === 'granted') router.push('/');
      else setModalOpen(true);
    });
  };

  const pickArea = (a: Area) => {
    pushRecentArea(a);
    saveLastArea(a); // 고른 동을 마지막 지역으로 기억해 메인이 여기서 시작한다(D45·D56)
    savePickedArea(a);
    router.push('/');
  };

  return (
    <>
      <div className="region-header">
        <div className="filters">
          <span className="select-wrap">
            <select aria-label="유형" className="select" value={filter} onChange={(e) => chooseFilter(e.target.value as ListFilter)}>
              <option value="pharmacy">약국</option>
              <option value="hospital">병원</option>
              <option value="pediatric">소아과</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} className="select-wrap__icon" />
          </span>
          <WhenSelect when={when} onChange={chooseWhen} />
        </div>
      </div>
      <p className="muted list-basis">
        {center ? `거리는 ${sigungu} 중심 기준이에요 · ` : null}
        <button type="button" className="link-btn" onClick={toMyArea}>
          내 동네 기준으로 보기
        </button>
      </p>
      {mounted ? (
        <MainList
          key={`${filter}|${when.kind === 'date' ? when.ymd : 'now'}`}
          items={items ?? []}
          mode={showAll ? 'all' : 'open'}
          now={now}
          ctx={ctx}
          when={when}
          holidayToday={ctx.holidays.has(kstParts(now).ymd)}
          loadingMore={false}
          failed={false}
          onRetry={() => {}}
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
