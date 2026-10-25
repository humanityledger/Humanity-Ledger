import { NextResponse } from "next/server";

/**
 * Retired on 23 October 2026.
 *
 * This route returned simulated Aztec data: invented transaction hashes,
 * fixed tree roots or balances that did not come from the network. The private
 * wallet now runs in the browser (lib/aztec/wallet/client.ts): balances are read
 * from the token contracts through the user's own PXE and every action is a
 * real transaction on the Aztec test network. The server takes no part in it,
 * so this route answers 410 and returns nothing that could be mistaken for a
 * result.
 */

function gone() {
  return NextResponse.json(
    { error: "Gone", code: "AZTEC_SERVER_ROUTE_RETIRED", detail: "The private wallet runs in your browser. See /docs/zero-knowledge." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  return gone();
}

export function POST() {
  return gone();
}
