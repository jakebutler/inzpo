CREATE TABLE "collection_items" (
	"collection_id" text NOT NULL,
	"item_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "collection_items_collection_id_item_id_pk" PRIMARY KEY("collection_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facet_values" (
	"id" text PRIMARY KEY NOT NULL,
	"facet_id" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "facets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "free_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "free_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "item_colors" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"hex" text NOT NULL,
	"family" text NOT NULL,
	"origin" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_facet_values" (
	"item_id" text NOT NULL,
	"facet_value_id" text NOT NULL,
	CONSTRAINT "item_facet_values_item_id_facet_value_id_pk" PRIMARY KEY("item_id","facet_value_id")
);
--> statement-breakpoint
CREATE TABLE "item_free_tags" (
	"item_id" text NOT NULL,
	"free_tag_id" text NOT NULL,
	CONSTRAINT "item_free_tags_item_id_free_tag_id_pk" PRIMARY KEY("item_id","free_tag_id")
);
--> statement-breakpoint
CREATE TABLE "item_sources" (
	"item_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"url_normalized" text NOT NULL,
	"title" text,
	"description" text,
	"preview_provenance_url" text,
	"oembed_html" text,
	"article_key" text,
	"article_bytes" integer
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"note" text,
	"capture_state" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"role" text NOT NULL,
	"original_key" text NOT NULL,
	"original_sha256" text NOT NULL,
	"original_bytes" integer NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"variants" jsonb NOT NULL,
	"placeholder" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "origins" (
	"derived_item_id" text PRIMARY KEY NOT NULL,
	"origin_item_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"filter_state" jsonb NOT NULL,
	"sort" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facet_values" ADD CONSTRAINT "facet_values_facet_id_facets_id_fk" FOREIGN KEY ("facet_id") REFERENCES "public"."facets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_colors" ADD CONSTRAINT "item_colors_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_facet_values" ADD CONSTRAINT "item_facet_values_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_facet_values" ADD CONSTRAINT "item_facet_values_facet_value_id_facet_values_id_fk" FOREIGN KEY ("facet_value_id") REFERENCES "public"."facet_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_free_tags" ADD CONSTRAINT "item_free_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_free_tags" ADD CONSTRAINT "item_free_tags_free_tag_id_free_tags_id_fk" FOREIGN KEY ("free_tag_id") REFERENCES "public"."free_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_sources" ADD CONSTRAINT "item_sources_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "origins" ADD CONSTRAINT "origins_derived_item_id_items_id_fk" FOREIGN KEY ("derived_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "origins" ADD CONSTRAINT "origins_origin_item_id_items_id_fk" FOREIGN KEY ("origin_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "facet_values_facet_value_uq" ON "facet_values" USING btree ("facet_id","value");