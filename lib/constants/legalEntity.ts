/**
 * lib/constants/legalEntity.ts
 *
 * Who is legally responsible for the service. Every legal page, the footer
 * and the site metadata read from here, so the identity of the provider is
 * stated once and stated the same way everywhere.
 *
 * Status on 23 October 2026: no company has been incorporated. The service is
 * provided by its founder as a private individual. Do not write "S.L.",
 * "Ltd", "Inc" or "Foundation" anywhere until a company exists and its
 * registry details are filled in below.
 *
 * Spanish law (LSSI-CE, article 10) requires the legal notice to show the
 * provider's name, tax identification number, address and an email address.
 * `taxId` and `postalAddress` are null until the founder supplies them. The
 * legal notice renders whatever is present and must not go to production
 * with either still null.
 */

export const LEGAL_ENTITY = {
  /** Legal name of the person or company that provides the service. */
  name: "Stefan Antonio Cirisanu",
  /** "individual" until a company is incorporated. */
  kind: "individual" as "individual" | "company",
  /** Trading name used on the websites. */
  tradingName: "Humanity Ledger",
  /** NIF or NIE. Required by LSSI-CE art. 10 before public launch. */
  taxId: null as string | null,
  /** Postal address for legal notices. Required by LSSI-CE art. 10. */
  postalAddress: null as string | null,
  /** The one address that receives legal, privacy and security mail. */
  email: "humanityledger@icloud.com",
  country: "Spain",
  /** Data protection supervisory authority for the provider. */
  supervisoryAuthority: {
    name: "Agencia Española de Protección de Datos",
    url: "https://www.aepd.es",
  },
  website: "https://humanidfi.com",
} as const;

/** Markdown link to the contact address, for use inside docs text. */
export const LEGAL_EMAIL_LINK = `[${LEGAL_ENTITY.email}](mailto:${LEGAL_ENTITY.email})`;

/** "Stefan Antonio Cirisanu, trading as Humanity Ledger" */
export const PROVIDER_LINE = `${LEGAL_ENTITY.name}, trading as ${LEGAL_ENTITY.tradingName}`;
