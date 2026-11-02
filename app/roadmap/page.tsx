import { redirect } from "next/navigation";

/**
 * Retired on 23 October 2026. This page described the product in ways the
 * code does not support (a token, open source licensing, guarantees that are
 * not met). The documentation is the single description of the product now;
 * old links land on the page that covers the same ground.
 */
export default function Moved() {
  redirect("/changelog");
}
