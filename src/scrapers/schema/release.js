import { z } from "zod";
import { LabelSchema } from "./shared.js";

export const TrackSchema = z.object({
  position: z.number().int().positive(),
  title: z.string(),
  duration: z.string().nullable(),
  hasLyrics: z.boolean(),
});

export const ReleasePerformerSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
  id: z.string().nullable(),
  roles: z.array(z.string()),
  involvement: z.enum(["member", "guest", "staff"]),
});

export const ReleaseDetailSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  artist: z
    .object({ name: z.string().nullable(), url: z.string().nullable(), id: z.string().nullable() })
    .nullable(),
  type: z.string().nullable(),
  releaseDate: z.string().nullable(),
  catalogId: z.string().nullable(),
  versionDesc: z.string().nullable(),
  label: LabelSchema.nullable(),
  format: z.string().nullable(),
  totalDuration: z.string().nullable(),
  tracks: z.array(TrackSchema),
  lineup: z.array(ReleasePerformerSchema),
  lastModifiedAtMetalArchives: z.string().nullable(),
  createdAtMetalArchives: z.string().nullable(),
});
