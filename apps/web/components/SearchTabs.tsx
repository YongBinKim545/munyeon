'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { hasPreviousPage } from '@/lib/navHistory';
import { pushRecentArea, readRecentAreas, saveLastArea, savePickedArea, type Area } from '@/lib/prefs';
import { AreaSearch } from './LocationSearchModal';
import { NameSearch } from './NameSearch';

type Tab = 'area' | 'name';
const TAB_KEY = 'munyeon:searchTab';

function readTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'name' ? 'name' : 'area';
  } catch {
    return 'area';
  }
}

/**
 * 헤더 [검색](D70): 위 탭 [지역] [기관 이름]. 처음은 지역, 마지막에 쓴 탭을 기억한다(이 브라우저에만).
 * 지역을 고르면 메인이 그 동으로 열린다(현재 위치보다 먼저, 마지막 지역으로 기억).
 * 주소에 ?q=가 있으면(상세에서 뒤로 돌아옴) 기관 이름 탭이다.
 */
export function SearchTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q');
  const [tab, setTab] = useState<Tab>(() => (q ? 'name' : 'area'));
  const [recent, setRecent] = useState<Area[]>([]);
  const areaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!q) setTab(readTab());
    setRecent(readRecentAreas());
  }, [q]);

  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // 저장 실패는 무시
    }
  };

  const close = () => (hasPreviousPage() ? router.back() : router.push('/'));

  const pick = (a: Area) => {
    pushRecentArea(a);
    saveLastArea(a);
    savePickedArea(a);
    router.push('/');
  };

  return (
    <>
      <div className="search-tabs" role="tablist" aria-label="검색 종류">
        {(['area', 'name'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            className="search-tabs__tab"
            onClick={() => choose(t)}
          >
            {t === 'area' ? '지역' : '기관 이름'}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="search-tabs__panel">
        {tab === 'area' ? <AreaSearch recent={recent} inputRef={areaInput} onPick={pick} onClose={close} /> : <NameSearch />}
      </div>
    </>
  );
}
