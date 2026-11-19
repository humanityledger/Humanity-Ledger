import { ReactNode } from 'react';

/**
 * /chat route layout. The chat itself is drawn by ChatKeepAlive (components/chat/surface) from the
 * root layout, so a live call survives leaving /chat; this route only marks where the user is.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
