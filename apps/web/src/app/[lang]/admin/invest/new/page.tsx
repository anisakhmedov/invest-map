import { Suspense } from "react";
import { ObjectFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function NewObjectPage() {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <ObjectFormPage id={null} />
    </Suspense>
  );
}
