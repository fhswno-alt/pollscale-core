import { LegalArticle } from "@/components/LegalArticle";
import { getLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  const page = await getLegalPage("guidelines");
  return { title: page.title };
}

export default async function GuidelinesPage() {
  const page = await getLegalPage("guidelines");
  return <LegalArticle page={page} />;
}
