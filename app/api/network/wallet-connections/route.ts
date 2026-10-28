import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Map ISO2 from cf-ipcountry to natural-earth country name used in the map
const ISO2_TO_NAME: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AO: "Angola",
  AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria",
  AZ: "Azerbaijan", BD: "Bangladesh", BY: "Belarus", BE: "Belgium",
  BZ: "Belize", BJ: "Benin", BO: "Bolivia", BA: "Bosnia and Herz.",
  BW: "Botswana", BR: "Brazil", BG: "Bulgaria", BF: "Burkina Faso",
  BI: "Burundi", KH: "Cambodia", CM: "Cameroon", CA: "Canada",
  CF: "Central African Rep.", TD: "Chad", CL: "Chile", CN: "China",
  CO: "Colombia", CG: "Congo", CR: "Costa Rica", HR: "Croatia",
  CU: "Cuba", CY: "Cyprus", CZ: "Czechia", CD: "Dem. Rep. Congo",
  DK: "Denmark", DJ: "Djibouti", DO: "Dominican Rep.", EC: "Ecuador",
  EG: "Egypt", SV: "El Salvador", GQ: "Eq. Guinea", ER: "Eritrea",
  EE: "Estonia", SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji",
  FI: "Finland", FR: "France", GA: "Gabon", GM: "Gambia",
  GE: "Georgia", DE: "Germany", GH: "Ghana", GR: "Greece",
  GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau", GY: "Guyana",
  HT: "Haiti", HN: "Honduras", HU: "Hungary", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland",
  IL: "Israel", IT: "Italy", CI: "Ivory Coast", JM: "Jamaica",
  JP: "Japan", JO: "Jordan", KZ: "Kazakhstan", KE: "Kenya",
  KP: "North Korea", KR: "South Korea", XK: "Kosovo", KW: "Kuwait",
  KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia", LB: "Lebanon",
  LS: "Lesotho", LR: "Liberia", LY: "Libya", LT: "Lithuania",
  LU: "Luxembourg", MG: "Madagascar", MW: "Malawi", MY: "Malaysia",
  ML: "Mali", MR: "Mauritania", MX: "Mexico", MD: "Moldova",
  MN: "Mongolia", ME: "Montenegro", MA: "Morocco", MZ: "Mozambique",
  MM: "Myanmar", NA: "Namibia", NP: "Nepal", NL: "Netherlands",
  NZ: "New Zealand", NI: "Nicaragua", NE: "Niger", NG: "Nigeria",
  MK: "North Macedonia", NO: "Norway", OM: "Oman", PK: "Pakistan",
  PA: "Panama", PG: "Papua New Guinea", PY: "Paraguay", PE: "Peru",
  PH: "Philippines", PL: "Poland", PT: "Portugal", PR: "Puerto Rico",
  QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda",
  SA: "Saudi Arabia", SN: "Senegal", RS: "Serbia", SL: "Sierra Leone",
  SO: "Somalia", ZA: "South Africa", SS: "S. Sudan", ES: "Spain",
  LK: "Sri Lanka", SD: "Sudan", SR: "Suriname", SE: "Sweden",
  CH: "Switzerland", SY: "Syria", TW: "Taiwan", TJ: "Tajikistan",
  TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste", TG: "Togo",
  TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan", UG: "Uganda",
  UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom",
  US: "United States of America", UY: "Uruguay", UZ: "Uzbekistan",
  VE: "Venezuela", VN: "Vietnam", YE: "Yemen", ZM: "Zambia",
  ZW: "Zimbabwe", HK: "Hong Kong", SG: "Singapore",
};

export async function GET() {
  try {
    // Count real registered users since February 2024
    const totalRealUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date("2024-02-01T00:00:00Z"),
        },
      },
    });

    // Try to load Redis country data if available
    let byCountry: Record<string, number> = {};
    let addedFromRedis = 0;

    try {
      const { redisClient } = await import("@/lib/redis/client");
      const redisCountries = await (redisClient as any)
        .hgetall("wc:country")
        .catch(() => ({}));

      for (const [code, countStr] of Object.entries(redisCountries || {})) {
        const countryName = ISO2_TO_NAME[code] || code;
        const count = parseInt(countStr as string) || 0;
        byCountry[countryName] = (byCountry[countryName] || 0) + count;
        addedFromRedis += count;
      }
    } catch {
      // Redis unavailable — continue without it
    }

    // Only countries we actually recorded a connection from. Accounts without
    // a recorded country used to be put on Spain, and an empty map got a made-up
    // "Spain: 1"; both showed places nobody connected from.
    const total = Math.max(totalRealUsers, addedFromRedis);
    const activeRegions = Object.keys(byCountry).length;

    return NextResponse.json(
      { byCountry, total, activeRegions, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    );
  } catch (err: any) {
    console.error("[wallet-connections]", err?.message);
    return NextResponse.json(
      { byCountry: {}, total: 0, activeRegions: 0, updatedAt: Date.now() },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    );
  }
}
