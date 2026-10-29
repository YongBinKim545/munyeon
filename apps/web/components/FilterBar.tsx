'use client';

import { ChevronDown } from 'lucide-react';
import { FILTER_LABEL, HOSPITAL_FILTERS, type HospitalFilter, type ListFilter } from '@/lib/nearby';
import { readHospitalFilter } from '@/lib/prefs';

/**
 * 목록 필터(D78): [병원 | 약국] 두 칸, 병원일 때만 진료과 [전체 ▾ / 소아과 / 산부인과 / 응급실].
 * [병원]을 누르면 마지막으로 고른 진료과(처음은 전체)로 연다. 메인·지역 화면이 같이 쓴다.
 */
export function FilterBar({ filter, onFilter }: { filter: ListFilter; onFilter: (f: ListFilter) => void }) {
  const pharmacy = filter === 'pharmacy';
  return (
    <div className="filters">
      <div className="seg" role="group" aria-label="유형">
        <button type="button" aria-pressed={!pharmacy} onClick={() => pharmacy && onFilter(readHospitalFilter())}>
          병원
        </button>
        <button type="button" aria-pressed={pharmacy} onClick={() => !pharmacy && onFilter('pharmacy')}>
          약국
        </button>
      </div>
      {pharmacy ? null : (
        <span className="select-wrap">
          <select aria-label="진료과" className="select" value={filter} onChange={(e) => onFilter(e.target.value as HospitalFilter)}>
            {HOSPITAL_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABEL[f]}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} className="select-wrap__icon" />
        </span>
      )}
    </div>
  );
}
