import { z } from "zod";

const emailSchema = z
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

export const updateOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export const deleteOrganizationSchema = z.object({
  confirmName: organizationNameSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
