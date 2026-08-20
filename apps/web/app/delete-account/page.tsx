import { LegalArticle } from "@/components/LegalArticle";
import { getLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  const page = await getLegalPage("deleteAccount");
  return { title: page.title };
}

export default async function DeleteAccountPage() {
  const page = await getLegalPage("deleteAccount");
  return <LegalArticle page={page} />;
}
