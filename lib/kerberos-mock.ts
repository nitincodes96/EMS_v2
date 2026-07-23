/**
 * Stand-in for IITD's real Kerberos/SSO assertion.
 *
 * A real integration replaces this with verification of a signed token/ticket
 * issued by IITD's authentication server (e.g. validating a CAS/SAML assertion
 * or a signed JWT), never with trusting freeform client input. Until that's
 * wired up, this deterministically derives a claims payload from the entered
 * Kerberos ID so the department-provisioning flow can be exercised end-to-end.
 *
 * Expected Kerberos ID shape: "<username>@<department-slug>.iitd.ac.in"
 * (mirrors IITD's real per-department email convention, e.g. name@cse.iitd.ac.in).
 */

export interface KerberosClaims {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  preferred_username: string;
  department: string;
  roles: string[];
  is_verified: boolean;
}

const KERBEROS_ID_PATTERN = /^([a-z0-9._-]+)@([a-z0-9-]+)\.iitd\.ac\.in$/i;

function toTitleCase(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export function mockKerberosAuthenticate(
  kerberosId: string,
  password: string
): KerberosClaims | null {
  if (!kerberosId || !password) return null;

  const match = kerberosId.trim().toLowerCase().match(KERBEROS_ID_PATTERN);
  if (!match) return null;

  const [, localPart, departmentSlug] = match;
  const nameParts = localPart.split(/[._]/).filter(Boolean);
  const givenName = toTitleCase(nameParts[0] ?? "Faculty");
  const familyName = toTitleCase(nameParts[1] ?? "Member");

  return {
    sub: localPart,
    name: `${givenName} ${familyName}`,
    given_name: givenName,
    family_name: familyName,
    email: `${localPart}@${departmentSlug}.iitd.ac.in`,
    preferred_username: localPart,
    department: departmentSlug,
    roles: ["faculty"],
    is_verified: true,
  };
}
