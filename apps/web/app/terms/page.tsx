import { LegalArticle } from "@/components/LegalArticle";
import { getLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  const page = await getLegalPage("terms");
  return { title: page.title };
}

export default async function TermsPage() {
  const page = await getLegalPage("terms");
  return <LegalArticle page={page} />;
}
