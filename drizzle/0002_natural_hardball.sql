CREATE TABLE "board_placements" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"item_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"w" integer NOT NULL,
	"h" integer NOT NULL,
	"z" integer DEFAULT 0 NOT NULL,
	"show_label" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Untitled board' NOT NULL,
	"background" text DEFAULT '#0a0a0a' NOT NULL,
	"canvas_w" integer NOT NULL,
	"canvas_h" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_placements" ADD CONSTRAINT "board_placements_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_placements" ADD CONSTRAINT "board_placements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_placements_board_item_uq" ON "board_placements" USING btree ("board_id","item_id");--> statement-breakpoint
CREATE INDEX "board_placements_board_id_idx" ON "board_placements" USING btree ("board_id");