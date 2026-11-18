import type { DocPage } from "../types";

/**
 * The community guidelines. Until 18 November 2026 they were a full-screen gate shown before the
 * chat opened (components/chat/ChatCommunityGate.tsx). They are now accepted on the sign-in
 * screen, next to the Terms of Service, and live here. The three terms are the compliance text
 * of that gate, word for word.
 */
export const communityGuidelines: DocPage = {
  slug: "community-guidelines",
  href: "/docs/community-guidelines",
  label: "Community guidelines",
  summary: "What you agree to when you use Ledger Chat: no objectionable content, user reports, and blocking.",
  keywords: ["guidelines", "community guidelines", "rules", "eula", "objectionable content", "report", "block", "moderation"],
  updated: "2026-11-18",
  blocks: [
    { t: "p", text: "By using LedgerChat, you agree to the following terms required for compliance:" },
    {
      t: "steps",
      items: [
        {
          title: "Zero Tolerance for Objectionable Content",
          text: "You will not post, transmit, or share any content that is abusive, harassing, threatening, defamatory, offensive, or otherwise objectionable.",
        },
        {
          title: "User Moderation",
          text: "You understand that other users may report your messages. If your account is reported multiple times for violating these guidelines, your access to Ledger Chat may be permanently revoked.",
        },
        {
          title: "Blocking",
          text: "You have the ability to block any user. Blocked users will not be able to contact you.",
        },
      ],
    },
    { t: "p", text: "You accept these terms when you continue on the sign-in screen. Violations result in loss of access." },
  ],
};
