import React from "react";
import Link from "next/link";

/**
 * Renders the small inline syntax used in lib/docs: **bold**, `code` and
 * [label](href). Anything else is plain text. Nesting is deliberately not
 * supported; documentation that needs it is usually trying to say too much
 * in one sentence.
 */

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function isExternal(href: string) {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");
}

export function Inline({ text, linkClass, codeClass }: { text: string; linkClass?: string; codeClass?: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className={codeClass}>
              {part.slice(1, -1)}
            </code>
          );
        }
        const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (m) {
          const [, label, href] = m;
          if (isExternal(href)) {
            const mail = href.startsWith("mailto:");
            return (
              <a
                key={i}
                href={href}
                className={linkClass}
                {...(mail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              >
                {label}
              </a>
            );
          }
          return (
            <Link key={i} href={href} className={linkClass}>
              {label}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export { isExternal };
