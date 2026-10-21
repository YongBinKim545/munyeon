'use client';

import { Search, X } from 'lucide-react';
import type { ReactNode, Ref } from 'react';

interface Props {
  inputId: string;
  /** 입력칸의 화면 낭독기용 이름 */
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  /** [검색]·엔터 */
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
  children?: ReactNode;
}

/**
 * 위치 검색·이름 검색 공통 틀(D43): 윗줄 [입력칸] [검색], 가운데 결과·로더, 맨 아래 전체 너비 [닫기].
 * 검색은 [검색]이나 엔터로만 실행하고, 실행하면 휴대폰 키보드를 닫는다.
 */
export function SearchPanel({ inputId, label, placeholder, value, onChange, onSubmit, onClose, loading, inputRef, autoFocus, children }: Props) {
  return (
    <div className="search-panel">
      <form
        className="search-panel__head"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          onSubmit();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          enterKeyHint="search"
          className="search__input"
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          <Search aria-hidden="true" size={18} /> 검색
        </button>
      </form>
      <div className="search-panel__body" aria-busy={loading}>
        {loading ? (
          <p className="search-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            찾는 중…
          </p>
        ) : (
          children
        )}
      </div>
      <div className="search-panel__foot">
        <button type="button" className="btn btn-secondary btn-wide" onClick={onClose}>
          <X aria-hidden="true" size={18} /> 닫기
        </button>
      </div>
    </div>
  );
}
