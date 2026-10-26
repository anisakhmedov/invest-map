import { Suspense } from "react";
import { ObjectFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function EditObjectPage({ params }: PageProps<"/[lang]/admin/invest/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/[lang]/admin/invest/[id]">["params"] }) {
  const { id } = await params;
  return <ObjectFormPage id={id} />;
}
