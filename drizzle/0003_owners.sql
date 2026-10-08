ALTER TABLE "facets" DROP CONSTRAINT "facets_name_unique";--> statement-breakpoint
ALTER TABLE "free_tags" DROP CONSTRAINT "free_tags_name_unique";--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "facets" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "free_tags" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "item_colors" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "item_colors" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "item_colors" ADD COLUMN "pin_x" real;--> statement-breakpoint
ALTER TABLE "item_colors" ADD COLUMN "pin_y" real;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "smart_collections" ADD COLUMN "owner_id" text DEFAULT 'legacy-jake' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "facets" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "free_tags" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "smart_collections" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "boards_owner_id_idx" ON "boards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "collections_owner_id_idx" ON "collections" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facets_owner_name_uq" ON "facets" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "facets_owner_id_idx" ON "facets" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "free_tags_owner_name_uq" ON "free_tags" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "free_tags_owner_id_idx" ON "free_tags" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "items_owner_id_idx" ON "items" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "items_owner_created_at_idx" ON "items" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "smart_collections_owner_id_idx" ON "smart_collections" USING btree ("owner_id");
