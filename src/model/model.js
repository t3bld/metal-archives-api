/**
 * Neo4j graph data model — defined in GraphQL SDL.
 *
 * This is a MODEL DEFINITION ONLY. There is no GraphQL server.
 * The SDL syntax is the standard way to describe a Neo4j graph schema,
 * and is understood by tooling (Neo4j Data Importer, arrows.app, @neo4j/graphql).
 *
 * Each `type` = a node label in the database.
 * Each `@relationship` = an edge between two node labels.
 * Properties listed here are the ones the scrapers write.
 *
 * Enforce uniqueness/indexes: node src/neo4j/constraints.js
 */

export const typeDefs = /* GraphQL */ `
  # ─── Artist ───────────────────────────────────────────────────────────────

  type Artist {
    "Numeric Metal Archives band ID (merge key)"
    id: String!
    name: String
    url: String
    status: String
    "Year the band was formed, as a string e.g. '1983'"
    formedIn: String

    # Timestamps
    createdAt: String
    updatedAt: String
    "Set after the artist detail page has been fully scraped"
    scrapedAt: String

    # Relationships
    country: Country @relationship(type: "FORMED_IN", direction: OUT)
    label: Label @relationship(type: "SIGNED_TO", direction: OUT)
    genres: [Genre!] @relationship(type: "PLAYS_GENRE", direction: OUT)
    themes: [Theme!] @relationship(type: "HAS_THEME", direction: OUT)
    releases: [Release!] @relationship(type: "RELEASED", direction: OUT)
    members: [Person!] @relationship(type: "PLAYED_IN", direction: IN)
    similarTo: [Artist!] @relationship(type: "SIMILAR_TO", direction: OUT)
  }

  # ─── Release ──────────────────────────────────────────────────────────────

  type Release {
    "Full MA album URL (merge key)"
    url: String!
    "Numeric MA album ID"
    albumId: String
    title: String
    "Release type: Full-length | EP | Single | Demo | …"
    type: String
    releaseDate: String
    catalogId: String
    "Edition description e.g. 'Japan, Enhanced'"
    versionDesc: String
    format: String
    reviewCount: Int
    "Average review score 0–100"
    reviewScore: Int
    "JSON string of track list (position, title, duration, notes, hasLyrics)"
    tracks: String

    # Timestamps
    createdAt: String
    updatedAt: String
    scrapedAt: String

    # Relationships
    artist: [Artist!] @relationship(type: "RELEASED", direction: IN)
    label: Label @relationship(type: "RELEASED_BY", direction: OUT)
    performers: [Person!] @relationship(type: "PERFORMED_ON", direction: IN)
  }

  # ─── Person ──────────────────────────────────────────────────────────────

  type Person {
    "MA artist profile URL (merge key)"
    url: String!
    "Numeric MA artist ID"
    personId: String
    pseudonym: String
    name: String
    age: Int
    "Raw birth date string e.g. 'Jun 6th, 1974'"
    birthDate: String
    "City / region e.g. 'Fayetteville, North Carolina'"
    birthPlace: String
    gender: String
    biography: String

    # Timestamps
    createdAt: String
    updatedAt: String
    scrapedAt: String

    # Relationships
    artists: [Artist!] @relationship(type: "PLAYED_IN", direction: OUT)
    releases: [Release!] @relationship(type: "PERFORMED_ON", direction: OUT)
    birthCountry: Country @relationship(type: "BORN_IN", direction: OUT)
  }

  # ─── Label ───────────────────────────────────────────────────────────────

  type Label {
    "MA label URL (merge key, may be 'name:<name>' for unsigned stubs)"
    url: String!
    "Numeric MA label ID"
    labelId: String
    name: String
    address: String
    phone: String
    "active | closed | unknown"
    status: String
    specialties: String
    foundingDate: String
    onlineShopping: Boolean
    website: String

    # Timestamps
    createdAt: String
    updatedAt: String
    scrapedAt: String

    # Relationships
    country: Country @relationship(type: "BASED_IN", direction: OUT)
    parentLabel: Label @relationship(type: "SUB_LABEL_OF", direction: OUT)
    subLabels: [Label!] @relationship(type: "SUB_LABEL_OF", direction: IN)
    artists: [Artist!] @relationship(type: "SIGNED_TO", direction: IN)
    releases: [Release!] @relationship(type: "RELEASED_BY", direction: IN)
  }

  # ─── Genre ───────────────────────────────────────────────────────────────

  type Genre {
    "Genre name (merge key) e.g. 'Death Metal'"
    name: String!
    artists: [Artist!] @relationship(type: "PLAYS_GENRE", direction: IN)
  }

  # ─── Theme ───────────────────────────────────────────────────────────────

  type Theme {
    "Theme name (merge key) e.g. 'Darkness'"
    name: String!
    artists: [Artist!] @relationship(type: "HAS_THEME", direction: IN)
  }

  # ─── Country ─────────────────────────────────────────────────────────────

  type Country {
    "ISO 3166-1 alpha-2 code (merge key) e.g. 'DE'"
    code: String!
    artists: [Artist!] @relationship(type: "FORMED_IN", direction: IN)
    labels: [Label!] @relationship(type: "BASED_IN", direction: IN)
    people: [Person!] @relationship(type: "BORN_IN", direction: IN)
  }

  # ─── Relationship properties ──────────────────────────────────────────────
  #
  # PLAYED_IN  (Person → Artist)
  #   memberType:  String  "current" | "past" | "live"
  #   roles:       [String]
  #   yearsActive: [String]  e.g. ["1991–2001", "2004–present"]
  #
  # PLAYS_GENRE  (Artist → Genre)
  #   period:     String | null  e.g. "early" | "later"
  #   modifiers:  [String]       e.g. ["melodic"]
  #   influences: [String]
  #
  # PERFORMED_ON  (Person → Release)
  #   roles:    [String]
  #   section:  String  "Band members" | "Guest/session musicians" | "Misc. staff"
  #             (maps to Lineup tab sub-tabs: Band members / Guest/session musicians / Misc. staff)
  #
  # SIMILAR_TO  (Artist → Artist)
  #   score:  Int  0–100
`;
