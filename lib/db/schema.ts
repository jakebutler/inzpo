import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

export const ITEM_KINDS = ["url", "screenshot", "photo", "palette", "article", "video"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const LINKED_KINDS = ["url", "article", "video"] as const;
export const IMAGE_KINDS = ["screenshot", "photo"] as const;

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().$type<ItemKind>(),
  title: text("title"),
  note: text("note"),
  captureState: text("capture_state").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const itemSources = pgTable("item_sources", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  urlNormalized: text("url_normalized").notNull(),
  title: text("title"),
  description: text("description"),
  previewProvenanceUrl: text("preview_provenance_url"),
  oembedHtml: text("oembed_html"),
  articleKey: text("article_key"),
  articleBytes: integer("article_bytes"),
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  originalKey: text("original_key").notNull(),
  originalSha256: text("original_sha256").notNull(),
  originalBytes: integer("original_bytes").notNull(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  variants: jsonb("variants").$type<Record<string, string>>().notNull(),
  placeholder: text("placeholder"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const itemColors = pgTable("item_colors", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  hex: text("hex").notNull(),
  family: text("family").notNull(),
  origin: text("origin").notNull(),
  position: integer("position").notNull().default(0),
});

export const facets = pgTable("facets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull(),
});

export const facetValues = pgTable(
  "facet_values",
  {
    id: text("id").primaryKey(),
    facetId: text("facet_id")
      .notNull()
      .references(() => facets.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("facet_values_facet_value_uq").on(t.facetId, t.value)],
);

export const itemFacetValues = pgTable(
  "item_facet_values",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    facetValueId: text("facet_value_id")
      .notNull()
      .references(() => facetValues.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.facetValueId] })],
);

export const freeTags = pgTable("free_tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const itemFreeTags = pgTable(
  "item_free_tags",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    freeTagId: text("free_tag_id")
      .notNull()
      .references(() => freeTags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.freeTagId] })],
);

export const collections = pgTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.itemId] })],
);

export const smartCollections = pgTable("smart_collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filterState: jsonb("filter_state").notNull(),
  sort: text("sort").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const origins = pgTable("origins", {
  derivedItemId: text("derived_item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  originItemId: text("origin_item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
});
