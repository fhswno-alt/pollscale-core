import { LegalArticle } from "@/components/LegalArticle";
import { getLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  const page = await getLegalPage("support");
  return { title: page.title };
}

export default async function SupportPage() {
  const page = await getLegalPage("support");
  return <LegalArticle page={page} />;
}
