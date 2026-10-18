import { institutionMetadata, InstitutionPage } from '@/components/InstitutionPage';

// 첫 요청 때 만들어 7일 캐시(ISR, D23·D30). 내용이 바뀌면 워커가 /api/revalidate로 갱신한다.
export const revalidate = 604800;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return institutionMetadata('hospital', id);
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <InstitutionPage kind="hospital" id={id} />;
}
