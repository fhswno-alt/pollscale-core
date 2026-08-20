import type { LegalPage } from "@/lib/legal";

export function LegalArticle({ page }: { page: LegalPage }) {
  return (
    <main className="page legal">
      <h1>{page.title}</h1>
      {page.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </main>
  );
}
