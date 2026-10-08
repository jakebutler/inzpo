import { HANDOFF_KITS } from "@/lib/mascot";
import { COLOR_ROLES } from "@/lib/db/schema";

export function KitCard({
  title,
  imageSrc,
  hexes,
}: {
  title: string;
  imageSrc?: string | null;
  hexes?: Array<string | null>;
}) {
  const sample = COLOR_ROLES.map((role) => HANDOFF_KITS.IMG_6505[role]);
  const raw = hexes && hexes.length > 0 ? hexes.slice(0, 6) : sample;
  const swatches: Array<string | null> = [...raw];
  while (swatches.length < 6) swatches.push(null);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={title} className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-32 items-center justify-center bg-muted text-sm text-muted-foreground">{title}</div>
      )}
      <div className="flex h-10">
        {swatches.map((hex, i) =>
          hex ? (
            <span key={`${hex}-${i}`} className="h-full flex-1" style={{ backgroundColor: hex }} />
          ) : (
            <span
              key={`empty-${i}`}
              className="h-full flex-1 border border-dashed border-muted-foreground/40 bg-transparent"
              aria-label="Empty swatch"
            />
          ),
        )}
      </div>
    </article>
  );
}
