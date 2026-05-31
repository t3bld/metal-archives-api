import { z } from "zod";

export const LabelRosterEntrySchema = z.object({
  bandName: z.string(),
  bandUrl: z.string().nullable(),
  section: z.string(),
});

export const SubLabelSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
});

export const LabelDetailSchema = z.object({
  url: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.string().nullable(),
  specialties: z.string().nullable(),
  foundingDate: z.string().nullable(),
  onlineShopping: z.boolean().nullable(),
  website: z.string().nullable(),
  subLabels: z.array(SubLabelSchema),
  roster: z.array(LabelRosterEntrySchema),
  lastModifiedAtMetalArchives: z.string().nullable(),
  createdAtMetalArchives: z.string().nullable(),
});
