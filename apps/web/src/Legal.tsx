const PAGES = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Pollscale is for people 13 and older. We collect the account data Apple or Google shares (name, email, subject id), the username you pick, polls you post, votes and skips, reports, follows, and a device id used to enforce the three guest votes.",
      "Images you upload are stored on object storage we control (or a local disk in development). We use OpenAI’s moderation API to score new polls. We do not sell personal data.",
      "You can delete your own live polls. You can delete your account in the app. That removes your profile, polls, follows, notifications, and push tokens. Vote rows are removed when they belong to you.",
      "Contact support@polescale.com for access or deletion requests.",
    ],
  },
  terms: {
    title: "Terms of Use",
    body: [
      "By using Pollscale you agree to these terms. You must be 13 or older. The product is English only.",
      "You get three votes without an account. After that you sign in with Apple or Google. Votes cannot be changed. There are no comments and no rating sliders.",
      "Anyone signed in may post a poll. Posts go live immediately unless automated moderation flags them. Flagged posts wait for a human (usually a few hours). We will notify you if a human approves or rejects the post.",
      "Politics is allowed. Sexual content, self-harm, hate, terror, graphic violence, sexual content involving minors, illegal activity, and spam are not. We may take a poll down. Repeated abuse can cost you the account.",
      "The iOS and Android apps are the product. This website does not host voting. App Store and Play listings are not live yet.",
      "support@polescale.com is the contact for these terms.",
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    body: [
      "Pollscale is a place to pick a side, not to host harm. These rules match the shape used by Instagram, X, and LinkedIn: say what is out, say how to report, say who to email.",
      "Illegal content. Do not post anything that breaks the law, including scams, threats, or trafficking.",
      "Hate. No dehumanizing people for who they are. Slurs in usernames are blocked.",
      "Terror. No praise, recruitment, or branding for terrorist groups.",
      "Graphic violence. No gore for shock. News-shaped political questions are allowed; snuff is not.",
      "Sexual content involving minors is never allowed. We will remove it and report it.",
      "Self-harm. No instructions, no encouragement, no “how should I…”. If you are in crisis, get help in the real world.",
      "Spam. No vote rings, no scrape-and-dump, no commercial floods.",
      "Sexual / NSFW content is not allowed on Pollscale. Politics is.",
      "Every poll has Report. We review reports in the same queue as AI-flagged posts. Target response is a few hours.",
      "English only. 13+.",
      "Email support@polescale.com if you need a human.",
    ],
  },
  support: {
    title: "Support",
    body: [
      "Email support@polescale.com. That is the only support channel for v2.",
      "Include your username and what you were doing. Do not send anyone else’s private data.",
      "To delete your account: sign in → You → Delete account. Apple requires this; we actually do it.",
      "To report a poll: open it → Report. Pick a reason.",
    ],
  },
} as const;

export function Legal({ kind }: { kind: keyof typeof PAGES }) {
  const page = PAGES[kind];
  return (
    <main className="page legal">
      <h1>{page.title}</h1>
      {page.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </main>
  );
}
