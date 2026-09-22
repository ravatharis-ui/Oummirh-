import type { Database } from "./database.types";

/** Convenience aliases. Kept out of database.types.ts so `npm run db:types` never drops them. */
type PublicSchema = Database["public"];

export type TableName = keyof PublicSchema["Tables"];
export type Row<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type Insert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type Update<T extends TableName> = PublicSchema["Tables"][T]["Update"];

export type Boutique = Row<"boutiques">;
export type ContractType = Row<"contract_types">;
export type UserRole = Row<"user_roles">;
export type Setting = Row<"settings">;
export type PublicHoliday = Row<"public_holidays">;
export type DomainEventRow = Row<"domain_events">;
export type NotificationRow = Row<"notifications">;
export type AuditLogRow = Row<"audit_log">;
export type LoginAttemptRow = Row<"login_attempts">;
