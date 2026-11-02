import React from "react";
import { SiteFooter } from "./v2/SiteFooter";

/**
 * SystemFooter — kept as a name so every page that already imports it picks
 * up the current footer. The implementation lives in v2/SiteFooter.tsx.
 */
export function SystemFooter() {
  return <SiteFooter />;
}

export default SystemFooter;
