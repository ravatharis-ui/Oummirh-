/**
 * Public API of the `employees` module.
 *
 * Everything the application may use lives here. Nothing else in this folder is
 * importable from outside, which ESLint enforces.
 */
export { employeesModule } from "./manifest";

export {
  employeeFiltersSchema,
  employeeInputSchema,
  employeeFormSchema,
  WEEKDAYS,
  type EmployeeFilters,
  type EmployeeFormValues,
  type EmployeeInput,
} from "./schemas";

export type { ActionResult, EmployeeSummary } from "./types";

export { getEmployee, getReferenceData, listEmployees } from "./server/queries";
export { createEmployee, resetPin, setEmployeeActive, updateEmployee } from "./server/actions";

export { EmployeeList } from "./ui/admin/employee-list";
export { EmployeeForm } from "./ui/admin/employee-form";
export { PinResetButton } from "./ui/admin/pin-reset-button";
export { ArchiveToggle } from "./ui/admin/archive-toggle";

export { generatePin, isAcceptablePin, hasPinShape, TRIVIAL_PINS } from "./domain/pin";
