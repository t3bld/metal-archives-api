import { z } from "zod";

export const YearRangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  as: z.string().nullable(),
});

export const ParsedYearsActiveSchema = z.array(YearRangeSchema);

export const LocationEntrySchema = z.object({
  city: z.string().nullable(),
  region: z.string().nullable(),
  period: z.string().nullable(),
});

export const ParsedLocationSchema = z.array(LocationEntrySchema);

export const ParsedThemesSchema = z.array(z.string());

export const GenrePeriodSchema = z.object({
  era: z.string(),
  genres: z.array(z.string()),
  modifiers: z.array(z.string()),
  influences: z.array(z.string()),
});

export const ParsedGenresSchema = z.array(GenrePeriodSchema);

export const LabelSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
});
