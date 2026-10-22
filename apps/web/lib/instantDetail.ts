import { useSyncExternalStore } from 'react';
import { rememberPreview, type DetailPreview } from './detailPreview';

/**
 * 목록에서 기관을 누르면 서버를 기다리지 않고 가진 정보로 상세를 바로 덮어 보여 준다(D51).
 * 서버 상세나 오류 화면이 붙으면(markDetailReady) 덮개를 걷는다. 오류 화면은 남겨 둔 미리보기로 상세를 대신 그린다.
 * 탭 안(메모리·sessionStorage)에만 있다.
 */
export interface InstantDetail {
  preview: DetailPreview;
  /** 상세 경로 '/pharmacy/C1' */
  path: string;
  /** 누를 때 있던 경로. 뒤로 가기·다른 이동을 알아채는 데 쓴다 */
  from: string;
}

let current: InstantDetail | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const STORE_KEY = 'munyeon:instantDetail';
/** 탭에 남겨 둔 미리보기를 쓰는 기한. 오래된 정보로 상세를 그리지 않게 한다 */
const STORE_TTL_MS = 10 * 60_000;

export function openInstantDetail(preview: DetailPreview, path: string, from: string): void {
  rememberPreview(preview);
  current = { preview, path, from };
  // 서버가 실패하면 Next가 페이지를 통째로 다시 불러 메모리가 사라지므로, 오류 화면에서 다시 쓸 수 있게 탭에 남긴다
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ path, preview, at: Date.now() }));
  } catch {
    // 저장 공간을 못 쓰면 오류 화면만 보인다
  }
  emit();
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

/** 이 경로를 누를 때 남겨 둔 미리보기(최근 것만) */
export function parseStoredPreview(raw: string | null, path: string, now = Date.now()): DetailPreview | null {
  try {
    const v = JSON.parse(raw ?? 'null') as { path: string; preview: DetailPreview; at: number } | null;
    return v && v.path === path && now - v.at < STORE_TTL_MS ? v.preview : null;
  } catch {
    return null;
  }
}

/** 오류 화면용: 서버 렌더·하이드레이션 때는 없음, 그 뒤 브라우저에서 읽는다 */
export function useStoredPreview(path: string): DetailPreview | null {
  const raw = useSyncExternalStore(() => () => {}, readStored, () => null);
  return parseStoredPreview(raw, path);
}

export function closeInstantDetail(): void {
  if (!current) return;
  current = null;
  emit();
}

/** 서버 상세(또는 오류 화면)가 화면에 붙었다 */
export function markDetailReady(path: string): void {
  if (current?.path === path) closeInstantDetail();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useInstantDetail(): InstantDetail | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
