import { z } from "zod";

const YearsActiveSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
});

export const AlbumAppearanceSchema = z.object({
  year: z.string().nullable(),
  title: z.string().nullable(),
  id: z.string().nullable(),
  roles: z.array(z.string()),
});

export const ArtistCreditSchema = z.object({
  type: z.enum(["active", "past", "guest", "misc"]),
  name: z.string(),
  id: z.string().nullable(),
  roles: z.array(z.string()),
  yearsActive: z.array(YearsActiveSchema),
  albums: z.array(AlbumAppearanceSchema),
});

export const PersonDetailSchema = z.object({
  pseudonym: z.string().nullable(),
  name: z.string().nullable(),
  age: z.number().int().nullable(),
  birth: z
    .object({
      date: z.string().nullable(),
      city: z.string().nullable(),
      region: z.string().nullable(),
      territory: z.string().nullable(),
      country: z.string().nullable(),
    })
    .nullable(),
  gender: z.string().nullable(),
  artists: z.array(ArtistCreditSchema),
  lastModifiedAtMetalArchives: z.string().nullable(),
  createdAtMetalArchives: z.string().nullable(),
});
