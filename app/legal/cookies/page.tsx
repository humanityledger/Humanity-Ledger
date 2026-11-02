import { redirect } from "next/navigation";

/**
 * Superseded. This page contained a second, contradictory version of a legal
 * text. The single current version lives in the documentation site.
 */
export default function Moved() {
  redirect("/docs/cookies");
}
