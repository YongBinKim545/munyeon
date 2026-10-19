'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deviceKind, type DeviceKind } from '@/lib/device';
import { useModal } from '@/lib/useModal';

export type GuideReason = 'denied' | 'unavailable';
export type GuideAction = 'retry' | 'search';

/** 기기별 위치 권한 켜는 방법. 메뉴 이름은 2026-10 기준 각 브라우저 화면을 따른다. */
const STEPS: { kind: Exclude<DeviceKind, 'unknown'>; title: string; lines: string[] }[] = [
  { kind: 'ios', title: '아이폰(사파리)', lines: ['주소창의 ᴀA › 웹사이트 설정 › 위치 › 허용', '안 되면: 설정 앱 › 개인정보 보호 및 보안 › 위치 서비스 › Safari 웹사이트'] },
  { kind: 'android', title: '안드로이드(크롬)', lines: ['주소창 왼쪽 아이콘 › 권한 › 위치 › 허용'] },
  { kind: 'desktop', title: 'PC(크롬·엣지)', lines: ['주소창 왼쪽 아이콘 › 위치 › 허용'] },
  { kind: 'inapp', title: '카카오톡·네이버 앱 안에서 보고 있다면', lines: ['크롬이나 사파리로 열어 주세요'] },
];

interface Props {
  reason: GuideReason;
  /** 'retry'는 [다시 시도], 'search'는 [위치 검색으로 찾기], null은 닫기 */
  onClosed: (action: GuideAction | null) => void;
}

/**
 * 위치 권한 안내 모달(D38). 거부된 상태에서 [현재 위치]를 누르면 연다.
 * 웹 페이지는 브라우저·휴대폰 설정 화면을 직접 열 수 없어서, 켜는 방법을 기기에 맞게 안내한다.
 */
export function LocationGuideModal({ reason, onClosed }: Props) {
  const { dialogRef, close } = useModal<GuideAction>('location-guide', onClosed);
  const [device, setDevice] = useState<DeviceKind>('unknown');
  useEffect(() => {
    // 기기는 브라우저에서만 알 수 있다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(deviceKind(navigator.userAgent));
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [dialogRef]);

  const steps = device === 'unknown' ? STEPS : STEPS.filter((s) => s.kind === device);
  const denied = reason === 'denied';

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialogRef} className="modal modal--guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <h2 id="guide-title">{denied ? '위치 권한이 꺼져 있어요' : '위치를 찾지 못했어요'}</h2>
        {denied ? (
          <>
            <p>현재 위치로 찾으려면 브라우저에서 위치 권한을 허용해 주세요.</p>
            <ul className="guide-steps">
              {steps.map((s) => (
                <li key={s.kind}>
                  <strong>{s.title}</strong>
                  {s.lines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </li>
              ))}
            </ul>
            <p className="muted">허용한 뒤 [다시 시도]를 눌러 주세요.</p>
          </>
        ) : (
          <p>휴대폰의 위치 서비스가 켜져 있는지 확인해 주세요.</p>
        )}
        <div className="guide-actions">
          <button type="button" className="btn btn-secondary" onClick={() => close('retry')}>
            <RefreshCw aria-hidden="true" size={18} /> 다시 시도
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => close('search')}>
            <Search aria-hidden="true" size={18} /> 위치 검색으로 찾기
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => close()}>
            <X aria-hidden="true" size={18} /> 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
