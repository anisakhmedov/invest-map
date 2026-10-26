import { Suspense } from "react";
import { ContentArticle, articleMetadata } from "@/components/content-article";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata({ params }: PageProps<"/[lang]/p/[slug]">) {
  const { slug } = await params;
  return articleMetadata("PAGE", slug);
}

export default function ContentPage({ params }: PageProps<"/[lang]/p/[slug]">) {
  return (
    <Suspense fallback={<PublicLoading kind="article" />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/[lang]/p/[slug]">["params"] }) {
  const { slug } = await params;
  return <ContentArticle kind="PAGE" slug={slug} />;
}
