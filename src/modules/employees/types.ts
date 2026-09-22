/** Public shape of a collaboratrice as the direction screens read her. */
export interface EmployeeSummary {
  id: string;
  authUserId: string | null;
  lastName: string;
  firstName: string;
  displayName: string;
  boutiqueId: string;
  boutiqueName: string;
  contractTypeId: string;
  contractLabel: string;
  email: string | null;
  phone: string | null;
  weeklyContractHours: number | null;
  defaultStart: string;
  defaultEnd: string;
  defaultBreakStart: string | null;
  defaultBreakEnd: string | null;
  workDays: number[];
  hireDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

/** Result envelope shared by every server action in this module. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
