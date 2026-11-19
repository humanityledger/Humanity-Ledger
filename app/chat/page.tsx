/**
 * /chat. The chat surface is mounted by ChatKeepAlive from the root layout (ClientLayout), not here:
 * a page unmounts when the user navigates away, and the call engine inside the chat would end the
 * call with it. ChatKeepAlive shows the surface on /chat and, while a call is live, keeps it
 * mounted but hidden everywhere else, with the call in the floating window or the island.
 */
export default function ChatPage() {
  return null;
}
