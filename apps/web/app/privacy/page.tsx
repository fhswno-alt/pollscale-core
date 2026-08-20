import { LegalArticle } from "@/components/LegalArticle";
import { getLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  const page = await getLegalPage("privacy");
  return { title: page.title };
}

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  return <LegalArticle page={page} />;
}
