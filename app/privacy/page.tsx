import { redirect } from "next/navigation";

/** This page moved into the documentation site. Old links keep working. */
export default function Moved() {
  redirect("/docs/privacy");
}
