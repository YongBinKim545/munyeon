'use client';

import { useEffect } from 'react';
import { rememberSource } from '@/lib/source';

/** 처음 들어온 페이지의 꼬리표·출처로 유입 경로를 정해 둔다(P0-11, D72). 화면에는 아무것도 그리지 않는다. */
export function SourceInit() {
  useEffect(() => {
    rememberSource();
  }, []);
  return null;
}
