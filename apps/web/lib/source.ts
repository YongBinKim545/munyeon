'use client';

import { classifySource, isTrafficSource, type TrafficSource } from '@munyeon/core';

/** 이 방문(탭) 동안만 기억한다(D72). 출처 주소·검색어 원문은 저장하지 않고 분류 값만 둔다. */
const KEY = 'munyeon:source';

function classifyHere(): TrafficSource {
  return classifySource({ search: location.search, referrer: document.referrer, ua: navigator.userAgent, host: location.host });
}

/** 처음 들어온 페이지에서 한 번 부른다. 이미 정했으면 그대로 둔다. */
export function rememberSource(): void {
  try {
    if (isTrafficSource(sessionStorage.getItem(KEY))) return;
    sessionStorage.setItem(KEY, classifyHere());
  } catch {
    // 저장이 막힌 브라우저는 이벤트를 보낼 때마다 그 자리에서 정한다
  }
}

export function currentSource(): TrafficSource {
  try {
    const v = sessionStorage.getItem(KEY);
    if (isTrafficSource(v)) return v;
  } catch {
    // 아래로
  }
  return classifyHere();
}
