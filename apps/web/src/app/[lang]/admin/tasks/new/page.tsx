import { Suspense } from "react";
import { TaskFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function NewTaskPage({ searchParams }: PageProps<"/[lang]/admin/tasks/new">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <New searchParams={searchParams} />
    </Suspense>
  );
}

async function New({ searchParams }: { searchParams: PageProps<"/[lang]/admin/tasks/new">["searchParams"] }) {
  const params = await searchParams;
  const request = Array.isArray(params.request) ? params.request[0] : params.request;
  return <TaskFormPage id={null} requestId={request ?? null} />;
}
