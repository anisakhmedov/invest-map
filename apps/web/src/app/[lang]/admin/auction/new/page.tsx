import { Suspense } from "react";
import { AuctionFormPage } from "../form-page";
import { AdminLoading } from "@/components/loading-states";

export default function NewAuctionPage() {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <AuctionFormPage id={null} />
    </Suspense>
  );
}
