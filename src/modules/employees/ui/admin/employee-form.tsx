"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select } from "@/core/ui/select";
import { cn } from "@/core/ui/utils";

import { createEmployee, updateEmployee } from "../../server/actions";
import {
  employeeFormSchema,
  WEEKDAYS,
  type EmployeeFormValues,
  type EmployeeInput,
} from "../../schemas";
import { PinDialog } from "./pin-dialog";

interface EmployeeFormProps {
  employeeId?: string;
  defaultValues: EmployeeFormValues;
  boutiques: { id: string; name: string }[];
  contractTypes: { id: string; label: string }[];
}

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

export function EmployeeForm({
  employeeId,
  defaultValues,
  boutiques,
  contractTypes,
}: EmployeeFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdPin, setCreatedPin] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues,
  });

  // `useWatch` rather than `watch`: it subscribes through `control`, which the
  // React Compiler can reason about.
  const workDays = useWatch({ control, name: "workDays" }) ?? [];

  const toggleDay = (day: number) => {
    const next = workDays.includes(day)
      ? workDays.filter((value) => value !== day)
      : [...workDays, day].sort((a, b) => a - b);
    setValue("workDays", next, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (employeeId) {
      const result = await updateEmployee(employeeId, values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push("/admin/collaboratrices");
      router.refresh();
      return;
    }

    const result = await createEmployee(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    // Stay on this screen until the code has been written down.
    setCreatedPin(result.data.pin);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field label="Prénom" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field
            label="Prénom affiché"
            htmlFor="displayName"
            hint="Ce que la collaboratrice verra sur l'écran de connexion."
            error={errors.displayName?.message}
          >
            <Input id="displayName" {...register("displayName")} />
          </Field>
          <Field label="Point de vente" htmlFor="boutiqueId" error={errors.boutiqueId?.message}>
            <Select id="boutiqueId" {...register("boutiqueId")}>
              {boutiques.map((boutique) => (
                <option key={boutique.id} value={boutique.id}>
                  {boutique.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Type de contrat"
            htmlFor="contractTypeId"
            error={errors.contractTypeId?.message}
          >
            <Select id="contractTypeId" {...register("contractTypeId")}>
              {contractTypes.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Heures par semaine"
            htmlFor="weeklyContractHours"
            hint="Par exemple 35 ou 24. Laissez vide si non applicable."
            error={errors.weeklyContractHours?.message}
          >
            <Input
              id="weeklyContractHours"
              inputMode="decimal"
              {...register("weeklyContractHours")}
            />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            htmlFor="email"
            hint="Facultatif. Sert uniquement aux notifications."
            error={errors.email?.message}
          >
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
          </Field>
          <Field label="Date d'embauche" htmlFor="hireDate" error={errors.hireDate?.message}>
            <Input id="hireDate" type="date" {...register("hireDate")} />
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Horaires par défaut</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Début" htmlFor="defaultStart" error={errors.defaultStart?.message}>
              <Input id="defaultStart" type="time" {...register("defaultStart")} />
            </Field>
            <Field label="Fin" htmlFor="defaultEnd" error={errors.defaultEnd?.message}>
              <Input id="defaultEnd" type="time" {...register("defaultEnd")} />
            </Field>
            <Field
              label="Début de pause"
              htmlFor="defaultBreakStart"
              error={errors.defaultBreakStart?.message}
            >
              <Input id="defaultBreakStart" type="time" {...register("defaultBreakStart")} />
            </Field>
            <Field
              label="Fin de pause"
              htmlFor="defaultBreakEnd"
              error={errors.defaultBreakEnd?.message}
            >
              <Input id="defaultBreakEnd" type="time" {...register("defaultBreakEnd")} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Label>Jours travaillés</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const active = workDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-12 min-w-12 rounded-xl border px-3 text-base transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-secondary",
                  )}
                >
                  <span className="sr-only">{day.label}</span>
                  <span aria-hidden>{day.short}</span>
                </button>
              );
            })}
          </div>
          {errors.workDays ? (
            <p className="text-destructive text-sm">{errors.workDays.message}</p>
          ) : null}
        </section>

        {serverError ? (
          <p role="status" className="text-destructive text-sm">
            {serverError}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
            {employeeId ? "Enregistrer" : "Créer la collaboratrice"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
        </div>
      </form>

      <PinDialog
        pin={createdPin}
        employeeName={defaultValues.displayName || "la collaboratrice"}
        onClose={() => {
          setCreatedPin(null);
          router.push("/admin/collaboratrices");
          router.refresh();
        }}
      />
    </>
  );
}
