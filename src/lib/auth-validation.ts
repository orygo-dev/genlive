import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Alamat email tidak valid.")
  .max(255, "Alamat email terlalu panjang.");

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
  .regex(/[A-Z]/, "Password harus memiliki huruf kapital.")
  .regex(/[0-9]/, "Password harus memiliki angka.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(80, "Nama maksimal 80 karakter.");

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Nama organisasi minimal 2 karakter.")
  .max(100, "Nama organisasi maksimal 100 karakter.");

export const registerSchema = z.object({
  name: displayNameSchema,
  organizationName: organizationNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi.").max(72),
});

export const updateProfileSchema = z.object({
  name: displayNameSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi.").max(72),
  newPassword: passwordSchema,
});

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
});

const recordingRetentionDaysSchema = z
  .union([
    z.literal(0),
    z.literal(7),
    z.literal(30),
    z.literal(90),
    z.literal(365),
    z.null(),
  ])
  .optional();

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{3,8}$/, "Format warna harus hex (#RRGGBB).")
  .max(20);

const urlSchema = z
  .string()
  .trim()
  .url("URL tidak valid.")
  .max(1000);

const domainSchema = z
  .string()
  .trim()
  .max(255)
  .regex(
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
    "Domain tidak valid.",
  );

const optionalUrlSchema = z
  .union([urlSchema, z.literal(""), z.null()])
  .optional();

const optionalDomainSchema = z
  .union([domainSchema, z.literal(""), z.null()])
  .optional();

export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
    recordingRetentionDays: recordingRetentionDaysSchema,
    brandName: z.string().trim().max(100).nullable().optional(),
    logoUrl: optionalUrlSchema,
    primaryColor: hexColorSchema.nullable().optional(),
    customDomain: optionalDomainSchema,
    ssoEnabled: z.boolean().optional(),
    ssoTenantHint: z.string().trim().max(255).nullable().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.recordingRetentionDays !== undefined ||
      data.brandName !== undefined ||
      data.logoUrl !== undefined ||
      data.primaryColor !== undefined ||
      data.customDomain !== undefined ||
      data.ssoEnabled !== undefined ||
      data.ssoTenantHint !== undefined,
    {
      message: "Tidak ada data untuk diperbarui.",
    },
  );

export const deleteOrganizationSchema = z.object({
  confirmName: organizationNameSchema,
});

export const deleteAccountSchema = z.object({
  confirmEmail: emailSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
