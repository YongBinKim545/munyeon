/**
 * 이 탭에서 앱 안으로 이동한 경로 수(D43). 이름 검색의 [닫기]가 직전 화면으로 돌아갈지(있으면 back),
 * 메인으로 갈지(주소로 바로 들어와 직전 화면이 없으면) 정하는 데만 쓴다. 저장하거나 서버로 보내지 않는다.
 */
let visits: string[] = [];

export function noteNavigation(path: string): void {
  if (visits.at(-1) !== path) visits.push(path);
}

export function hasPreviousPage(): boolean {
  return visits.length > 1;
}

/** 테스트용 */
export function resetNavigation(): void {
  visits = [];
}
