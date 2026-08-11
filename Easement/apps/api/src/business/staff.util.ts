/** Staff row with optional linked login account. */
export type StaffProfile = {
  name: string;
  email?: string | null;
  phone?: string | null;
  user?: { name: string; email?: string; phone?: string | null } | null;
};

export function staffDisplayName(staff: StaffProfile): string {
  return staff.user?.name ?? staff.name;
}

export function staffDisplayEmail(staff: StaffProfile): string | null {
  return staff.user?.email ?? staff.email ?? null;
}

export function staffDisplayPhone(staff: StaffProfile): string | null {
  return staff.user?.phone ?? staff.phone ?? null;
}
