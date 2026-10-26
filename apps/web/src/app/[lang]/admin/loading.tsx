import { getDictionary } from "@/i18n/get-dictionary";
import { SkeletonPage, SkeletonHeading, SkeletonTable } from "@/components/skeleton";

export default async function Loading() {
  const dict = await getDictionary();
  return (
    <SkeletonPage label={dict.public.loading}>
      <SkeletonHeading lead={false} />
      <SkeletonTable rows={6} columns={4} />
    </SkeletonPage>
  );
}
