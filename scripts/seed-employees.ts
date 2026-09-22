/**
 * Creates the direction account and the ten collaboratrices.
 *
 * Runs from GitHub Actions (workflow « Base de données », option « Créer les
 * collaboratrices ») or locally with `npm run seed:employees`.
 *
 * Two things matter here.
 *
 * First, it is idempotent: a collaboratrice already present is left exactly as she
 * is, so a second run never duplicates anyone nor resets a code in use.
 *
 * Second, the PINs it draws are deliberately thrown away. They are random, hashed
 * by the database, and printed nowhere by default. The direction then draws each
 * real code from /admin/collaboratrices, where it is shown once. That is one less
 * file full of credentials, and it is the same screen used forever after when
 * someone forgets her code.
 */
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import type { Database } from "../src/core/db/database.types";
import { generatePin } from "../src/modules/employees/domain/pin";

loadEnv({ path: ".env.local", quiet: true });

const STAFF_EMAIL_DOMAIN = "staff.oummi.invalid";

interface SeedEmployee {
  lastName: string;
  firstName: string;
  boutiqueCode: string;
  contractCode: string;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
  weeklyHours: number;
}

const EMPLOYEES: SeedEmployee[] = [
  {
    lastName: "ADAM",
    firstName: "Loubna",
    boutiqueCode: "STDENIS",
    contractCode: "CDI",
    start: "09:30",
    end: "18:00",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "ADAM",
    firstName: "Chamyma",
    boutiqueCode: "STDENIS",
    contractCode: "CDD",
    start: "09:30",
    end: "18:00",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "BLUKER",
    firstName: "Yolaine",
    boutiqueCode: "STPAUL",
    contractCode: "CDI",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "MESSINE",
    firstName: "Annie",
    boutiqueCode: "STPAUL",
    contractCode: "CDI",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "MURAT",
    firstName: "Carinne",
    boutiqueCode: "STPIERRE",
    contractCode: "CDI",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "AGATHE",
    firstName: "Elisa",
    boutiqueCode: "STPIERRE",
    contractCode: "CDD",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "ZITTE",
    firstName: "Maëva",
    boutiqueCode: "STPIERRE",
    contractCode: "TEMPS_PARTIEL",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 24,
  },
  {
    lastName: "HODGI",
    firstName: "Laurine",
    boutiqueCode: "STLOUIS",
    contractCode: "CDD",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 35,
  },
  {
    lastName: "CHAMBAUD",
    firstName: "Léna",
    boutiqueCode: "STLOUIS",
    contractCode: "TEMPS_PARTIEL",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 24,
  },
  {
    lastName: "HOARAU",
    firstName: "Zoé",
    boutiqueCode: "ONLINE",
    contractCode: "TEMPS_PARTIEL",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    weeklyHours: 24,
  },
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`✗ Variable manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = required("ADMIN_EMAIL");
  const adminPassword = required("ADMIN_PASSWORD");

  if (adminPassword.length < 12) {
    console.error("✗ ADMIN_PASSWORD doit faire au moins 12 caractères.");
    process.exit(1);
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Direction account ------------------------------------------------------
  console.log("→ Compte de direction");
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let adminUserId = existingUsers?.users.find((user) => user.email === adminEmail)?.id;

  if (adminUserId) {
    console.log("   déjà présent, inchangé");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`✗ Création du compte de direction impossible : ${error?.message}`);
      process.exit(1);
    }
    adminUserId = data.user.id;
    console.log("   créé");
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .upsert({ user_id: adminUserId, role: "admin", boutique_id: null });
  if (roleError) {
    console.error(`✗ Attribution du rôle admin impossible : ${roleError.message}`);
    process.exit(1);
  }

  // --- Sign in as the direction ----------------------------------------------
  // Collaboratrices are then created through exactly the path a human uses, so the
  // audit trail names a real actor rather than an anonymous service key.
  const asDirection = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await asDirection.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (signInError) {
    console.error(`✗ Connexion à la direction impossible : ${signInError.message}`);
    console.error("  Le mot de passe a-t-il changé depuis la création du compte ?");
    process.exit(1);
  }

  // --- Reference data ---------------------------------------------------------
  const [{ data: boutiques }, { data: contracts }] = await Promise.all([
    asDirection.from("boutiques").select("id, code"),
    asDirection.from("contract_types").select("id, code"),
  ]);

  const boutiqueByCode = new Map((boutiques ?? []).map((row) => [row.code, row.id]));
  const contractByCode = new Map((contracts ?? []).map((row) => [row.code, row.id]));

  if (boutiqueByCode.size === 0) {
    console.error("✗ Aucun point de vente en base. Appliquez d'abord les migrations.");
    process.exit(1);
  }

  // --- Collaboratrices --------------------------------------------------------
  console.log("→ Collaboratrices");
  const created: { name: string; pin: string }[] = [];
  let skipped = 0;

  for (const person of EMPLOYEES) {
    const { data: already } = await asDirection
      .from("employees")
      .select("id")
      .eq("last_name", person.lastName)
      .eq("first_name", person.firstName)
      .maybeSingle();

    if (already) {
      skipped += 1;
      continue;
    }

    const boutiqueId = boutiqueByCode.get(person.boutiqueCode);
    const contractTypeId = contractByCode.get(person.contractCode);
    if (!boutiqueId || !contractTypeId) {
      console.error(`✗ ${person.firstName} : boutique ou contrat inconnu, ignorée`);
      continue;
    }

    const { data: account, error: accountError } = await admin.auth.admin.createUser({
      email: `${crypto.randomUUID()}@${STAFF_EMAIL_DOMAIN}`,
      email_confirm: true,
    });
    if (accountError || !account.user) {
      console.error(`✗ ${person.firstName} : compte impossible (${accountError?.message})`);
      continue;
    }

    const pin = generatePin((max) => randomInt(max));
    const { error } = await asDirection.rpc("admin_create_employee", {
      p_auth_user_id: account.user.id,
      p_last_name: person.lastName,
      p_first_name: person.firstName,
      p_display_name: person.firstName,
      p_boutique_id: boutiqueId,
      p_contract_type_id: contractTypeId,
      p_pin: pin,
      p_weekly_contract_hours: person.weeklyHours,
      p_default_start: person.start,
      p_default_end: person.end,
      p_default_break_start: person.breakStart,
      p_default_break_end: person.breakEnd,
      p_work_days: [1, 2, 3, 4, 5, 6],
    });

    if (error) {
      await admin.auth.admin.deleteUser(account.user.id).catch(() => undefined);
      console.error(`✗ ${person.firstName} : ${error.message}`);
      continue;
    }

    created.push({ name: `${person.lastName} ${person.firstName}`, pin });
    console.log(`   créée : ${person.lastName} ${person.firstName}`);
  }

  console.log(`\n${created.length} créée(s), ${skipped} déjà présente(s).`);

  // Opt-in on purpose: a file of live PINs is a liability, and the direction can
  // draw each code from /admin/collaboratrices, where it is shown exactly once.
  if (process.env.WRITE_PINS_CSV === "1" && created.length > 0) {
    const directory = join(process.cwd(), "seed-output");
    mkdirSync(directory, { recursive: true });
    const csv = ["nom,code_pin", ...created.map((row) => `"${row.name}",${row.pin}`)].join("\n");
    writeFileSync(join(directory, "pins.csv"), `${csv}\n`, { mode: 0o600 });
    console.log("Codes écrits dans seed-output/pins.csv (ignoré par Git).");
  } else if (created.length > 0) {
    console.log("\nLes codes PIN tirés ne sont affichés nulle part et ne sont connus de personne.");
    console.log(
      "Ouvrez /admin/collaboratrices et utilisez « Réinitialiser le code PIN » pour chacune :",
    );
    console.log("le code y est affiché une seule fois, à transmettre de vive voix.");
  }

  await asDirection.auth.signOut();
}

main().catch((cause: unknown) => {
  console.error("✗ Échec inattendu :", cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
