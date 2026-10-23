'use client';

import { dateLabel } from '@munyeon/core';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dateRange, NOW, type When } from '@/lib/when';

/**
 * [언제 ▾]: 지금 문 연 / 날짜(부모님 대신 일요일·공휴일 찾기). 날짜는 휴대폰 기본 달력으로 고른다(오늘부터 90일).
 * 고른 날짜는 선택지에 '10/25(일)'로 남는다.
 */
export function WhenSelect({ when, onChange }: { when: When; onChange: (w: When) => void }) {
  const [picking, setPicking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const range = dateRange(new Date());

  useEffect(() => {
    if (!picking) return;
    input.current?.focus();
    try {
      input.current?.showPicker?.();
    } catch {
      // 사용자 동작 밖이라 막히면 입력칸을 눌러 고르면 된다
    }
  }, [picking]);

  const value = picking ? 'pick' : when.kind === 'date' ? when.ymd : 'now';
  return (
    <>
      <span className="select-wrap">
        <select
          aria-label="언제"
          className="select"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'now') {
              setPicking(false);
              onChange(NOW);
            } else if (v === 'pick') setPicking(true);
          }}
        >
          <option value="now">지금 문 연</option>
          {when.kind === 'date' ? <option value={when.ymd}>{dateLabel(when.ymd)}</option> : null}
          <option value="pick">날짜</option>
        </select>
        <ChevronDown aria-hidden="true" size={16} className="select-wrap__icon" />
      </span>
      {picking ? (
        <input
          ref={input}
          type="date"
          aria-label="날짜"
          className="select when-date"
          min={range.min}
          max={range.max}
          defaultValue={when.kind === 'date' ? when.ymd : range.min}
          onChange={(e) => {
            if (!e.target.value) return;
            setPicking(false);
            onChange({ kind: 'date', ymd: e.target.value });
          }}
        />
      ) : null}
    </>
  );
}
