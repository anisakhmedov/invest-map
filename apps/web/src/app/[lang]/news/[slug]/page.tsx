import { Suspense } from "react";
import { ContentArticle, articleMetadata } from "@/components/content-article";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata({ params }: PageProps<"/[lang]/news/[slug]">) {
  const { slug } = await params;
  return articleMetadata("NEWS", slug);
}

export default function NewsItemPage({ params }: PageProps<"/[lang]/news/[slug]">) {
  return (
    <Suspense fallback={<PublicLoading kind="article" />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/[lang]/news/[slug]">["params"] }) {
  const { slug } = await params;
  return <ContentArticle kind="NEWS" slug={slug} />;
}
