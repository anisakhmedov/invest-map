import { getDictionary } from "@/i18n/get-dictionary";
import { SkeletonPage, SkeletonHeading, SkeletonForm } from "@/components/skeleton";

export default async function Loading() {
  const dict = await getDictionary();
  return (
    <SkeletonPage label={dict.public.loading}>
      <SkeletonHeading />
      <SkeletonForm fields={6} />
    </SkeletonPage>
  );
}
