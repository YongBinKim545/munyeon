// 지금 응답하는 배포의 커밋. 배포 직후 미리 만들기(P0-10)가 새 배포로 바뀐 것을 확인하고 시작하는 데 쓴다.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
