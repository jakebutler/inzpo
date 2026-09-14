CREATE INDEX "collection_items_item_id_idx" ON "collection_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_colors_item_id_family_idx" ON "item_colors" USING btree ("item_id","family");--> statement-breakpoint
CREATE INDEX "item_facet_values_item_id_idx" ON "item_facet_values" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_facet_values_facet_value_id_idx" ON "item_facet_values" USING btree ("facet_value_id");--> statement-breakpoint
CREATE INDEX "item_free_tags_item_id_idx" ON "item_free_tags" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_free_tags_free_tag_id_idx" ON "item_free_tags" USING btree ("free_tag_id");--> statement-breakpoint
CREATE INDEX "item_sources_url_normalized_idx" ON "item_sources" USING btree ("url_normalized");--> statement-breakpoint
CREATE INDEX "items_capture_state_created_at_idx" ON "items" USING btree ("capture_state","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_assets_item_id_idx" ON "media_assets" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "media_assets_original_key_idx" ON "media_assets" USING btree ("original_key");--> statement-breakpoint
CREATE INDEX "origins_origin_item_id_idx" ON "origins" USING btree ("origin_item_id");