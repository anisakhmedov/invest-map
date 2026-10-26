import { Suspense } from "react";
import { AuctionFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function EditAuctionPage({ params }: PageProps<"/[lang]/admin/auction/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/[lang]/admin/auction/[id]">["params"] }) {
  const { id } = await params;
  return <AuctionFormPage id={id} />;
}
