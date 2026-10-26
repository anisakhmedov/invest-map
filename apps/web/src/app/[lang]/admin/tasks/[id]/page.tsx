import { Suspense } from "react";
import { TaskFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function EditTaskPage({ params }: PageProps<"/[lang]/admin/tasks/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/[lang]/admin/tasks/[id]">["params"] }) {
  const { id } = await params;
  return <TaskFormPage id={id} requestId={null} />;
}
