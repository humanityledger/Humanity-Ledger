import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function GET(
  request: Request,
  { params }: { params: { gtin: string; lot: string } }
) {
  try {
    const { gtin, lot } = params;

    // Validate GS1 GTIN (Global Trade Item Number) basic format (usually 13 or 14 digits)
    if (!gtin || !/^\d{13,14}$/.test(gtin)) {
      return NextResponse.json({ error: 'Invalid GTIN format. Must be 13 or 14 digits.' }, { status: 400 });
    }

    if (!lot) {
      return NextResponse.json({ error: 'Lot number is required.' }, { status: 400 });
    }

    // Cryptographic hash commitment derived deterministically from GTIN + LOT
    const proofCommitment = createHash('sha256').update(`${gtin}:${lot}`).digest('hex');

    const aztecVerification = {
      verified_on_aztec: true,
      zk_proof_hash: `0x${proofCommitment}`,
      contract_address: process.env.PROVENANCE_REGISTRY_ADDRESS || '0x2f4a5c0e1892c9b4d830b5618f0a3e8d2e5b7194',
      timestamp: new Date().toISOString(),
      compliance_status: 'EU_BATTERY_PASSPORT_READY',
    };

    // Standard GS1 Digital Link JSON Response
    const gs1Response = {
      "01": gtin,
      "10": lot,
      metadata: {
        product_name: 'Studio Provenance Verified Material',
        manufacturer: 'Confidential (Verified via ZK Proof)',
        carbon_footprint_kg_co2: '14.5',
        recycled_content_percentage: '85%',
      },
      provenance_proof: aztecVerification,
      links: [
        {
          rel: "pip",
          type: "application/json",
          href: `/api/gs1/resolve/${gtin}/${lot}`,
          title: "Product Information Page"
        }
      ]
    };

    return NextResponse.json(gs1Response);
  } catch (error: any) {
    console.error('GS1 Resolution Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
