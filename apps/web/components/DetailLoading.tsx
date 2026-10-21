/**
 * 기관 상세를 처음 만드는 동안(ISR 첫 요청, 몇 초 걸릴 수 있다) 바로 보이는 틀.
 * 카드를 누르자마자 반응이 보이게 한다. 상태 문구는 넣지 않는다.
 */
export function DetailLoading() {
  return (
    <main className="container container--wide">
      <div className="detail-loading" role="status">
        <div className="skeleton skeleton--title" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton skeleton--short" aria-hidden="true" />
        <p className="muted">정보를 불러오고 있어요…</p>
      </div>
    </main>
  );
}
