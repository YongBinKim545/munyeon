'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode, type Ref } from 'react';

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

/** 화면 높이가 이만큼 줄면 키보드가 올라온 것으로 본다 */
const KEYBOARD_PX = 120;

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * 휴대폰 키보드가 맨 아래 [닫기]를 가리므로, 키보드가 올라와 있는 동안 [닫기]를 검색창 바로 아래로 옮긴다(D45).
 * 되돌리는 시점은 포커스가 빠질 때가 아니라 키보드가 실제로 내려간 뒤(화면 높이가 돌아옴)다.
 * 결과를 누르는 순간 배치가 움직여 다른 행이 눌리는 일을 막는다.
 */
function useCloseOnTop() {
  const [onTop, setOnTop] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let full = vv.height;
    let keyboardUp = false;
    const onResize = () => {
      full = Math.max(full, vv.height);
      const up = vv.height < full - KEYBOARD_PX;
      if (up && !keyboardUp && isTouch() && document.activeElement instanceof HTMLInputElement) setOnTop(true);
      if (!up && keyboardUp) setOnTop(false);
      keyboardUp = up;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  /** 입력칸을 누르는 순간(키보드가 올라오기 전)에 미리 옮긴다 */
  const onInputPointerDown = () => {
    if (isTouch()) setOnTop(true);
  };
  return { onTop, onInputPointerDown };
}

/**
 * 위치 검색·이름 검색 공통 틀(D43): 윗줄 [입력칸] [검색], 가운데 결과·로더, 맨 아래 전체 너비 [닫기].
 * 검색은 [검색]이나 엔터로만 실행하고, 실행하면 휴대폰 키보드를 닫는다.
 */
export function SearchPanel({ inputId, label, placeholder, value, onChange, onSubmit, onClose, loading, inputRef, autoFocus, children }: Props) {
  const { onTop, onInputPointerDown } = useCloseOnTop();
  const close = (
    <button type="button" className="btn btn-secondary btn-wide" onClick={onClose}>
      <X aria-hidden="true" size={18} /> 닫기
    </button>
  );
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
          onPointerDown={onInputPointerDown}
        />
        <button type="submit" className="btn btn-secondary">
          <Search aria-hidden="true" size={18} /> 검색
        </button>
      </form>
      {onTop ? <div className="search-panel__close-top">{close}</div> : null}
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
      {onTop ? null : <div className="search-panel__foot">{close}</div>}
    </div>
  );
}
