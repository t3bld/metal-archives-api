import { z } from "zod";
import {
  ParsedYearsActiveSchema,
  ParsedLocationSchema,
  ParsedThemesSchema,
  ParsedGenresSchema,
  LabelSchema,
} from "./shared.js";

export const ArtistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string().nullable(),
  location: z.string().nullable(),
  status: z.string().nullable(),
  url: z.string().nullable(),
});

export const DiscographyEntrySchema = z.object({
  id: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
});

export const MemberYearRangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
});

export const OtherActivitySchema = z.object({
  name: z.string(),
  id: z.string().nullable(),
  url: z.string().nullable(),
  status: z.enum(["active", "past"]),
});

export const MemberSchema = z.object({
  status: z.enum(["current", "past", "live"]),
  id: z.string().nullable(),
  name: z.string(),
  url: z.string().nullable(),
  roles: z.array(z.string()),
  yearsActive: z.array(MemberYearRangeSchema),
  otherArtistInvolvements: z.array(OtherActivitySchema),
});

export const SimilarArtistSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  url: z.string().nullable(),
  country: z.string().nullable(),
  score: z.number().int().nullable(),
  genres: ParsedGenresSchema.nullable(),
});

export const RelatedLinkSchema = z.object({
  category: z.string().nullable(),
  title: z.string().nullable(),
  url: z.string().nullable(),
});

export const ArtistSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable(),
  location: ParsedLocationSchema.nullable(),
  status: z.string().nullable(),
  formedIn: z.string().nullable(),
  yearsActive: ParsedYearsActiveSchema.nullable(),
  genres: ParsedGenresSchema.nullable(),
  themes: ParsedThemesSchema.nullable(),
  label: LabelSchema.nullable(),
  discography: z.array(DiscographyEntrySchema),
  members: z.array(MemberSchema),
  similarArtists: z.array(SimilarArtistSchema),
  relatedLinks: z.array(RelatedLinkSchema),
  lastModifiedAtMetalArchives: z.string().nullable(),
  createdAtMetalArchives: z.string().nullable(),
});
