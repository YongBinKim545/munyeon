'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readLastArea } from '@/lib/prefs';

export interface RegionRow {
  name: string;
  href: string;
  /** DB를 못 읽었으면 null(이름만 보인다) */
  pharmacy: number | null;
  hospital: number | null;
}

const fmt = (n: number | null) => (n === null ? '–' : n.toLocaleString('ko-KR'));

/**
 * 지역으로 찾기·시도 페이지의 표(D53): 지역 | 약국 | 병원. 서버는 가나다순으로 그리고,
 * 브라우저에서 메인에서 마지막으로 보던 지역(이 브라우저에만 저장)을 맨 위로 올려 '내 지역'으로 표시한다.
 * sido를 주면 그 시도 안의 시군구 표다.
 */
export function RegionTable({ rows, sido }: { rows: RegionRow[]; sido?: string }) {
  const [mine, setMine] = useState<string | null>(null);

  useEffect(() => {
    const a = readLastArea();
    const name = sido ? (a?.sido === sido ? a?.sigungu : null) : a?.sido;
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다(서버 HTML과 첫 렌더를 맞춘다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(name && rows.some((r) => r.name === name) ? name : null);
  }, [rows, sido]);

  const ordered = mine ? [...rows.filter((r) => r.name === mine), ...rows.filter((r) => r.name !== mine)] : rows;
  return (
    <table className="region-table">
      <thead>
        <tr>
          <th scope="col">{sido ? '시군구' : '시도'}</th>
          <th scope="col">약국</th>
          <th scope="col">병원</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((r) => (
          <tr key={r.name} className={r.name === mine ? 'is-mine' : undefined}>
            <th scope="row">
              <Link href={r.href}>
                {r.name}
                {r.name === mine ? <span className="badge region-table__mine">내 지역</span> : null}
              </Link>
            </th>
            <td>{fmt(r.pharmacy)}</td>
            <td>{fmt(r.hospital)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
