import { getDictionary } from "@/i18n/get-dictionary";
import { SkeletonPage, SkeletonHeading, SkeletonMap } from "@/components/skeleton";

export default async function Loading() {
  const dict = await getDictionary();
  return (
    <SkeletonPage label={dict.public.loading}>
      <SkeletonHeading lead={false} />
      <SkeletonMap />
    </SkeletonPage>
  );
}
