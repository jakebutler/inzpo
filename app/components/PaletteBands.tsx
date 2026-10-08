"use client";

import type { MutableRefObject } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { BAND_H_EDITOR, BAND_H_RESULT, PAGE_BAND_HAIRLINE, PAPER } from "@/lib/brand";
import { bandLabelColor, gatedTextColor, matchesPageBackground } from "@/lib/contrast";
import { EMPTY_ROLE_COPY } from "@/lib/brief-copy";
import { MOTION_CSS } from "@/lib/motion";
import type { RoleColors } from "@/lib/tokens";

export function PaletteBands({
  roles,
  size,
  pageBackground = PAPER,
  pageInk,
  onPick,
  onFocusRole,
  bandRefs,
}: {
  roles: RoleColors;
  size: "result" | "editor";
  pageBackground?: string;
  pageInk?: string;
  onPick?: (role: ColorRole) => void;
  onFocusRole?: (role: ColorRole | null) => void;
  bandRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
}) {
  const height = size === "editor" ? BAND_H_EDITOR : BAND_H_RESULT;
  return (
    <div className="inzpo-bands" data-bands={size} role="list">
      {COLOR_ROLES.map((role, i) => {
        const hex = roles[role];
        if (!hex) {
          const emptyInk = gatedTextColor(pageInk ?? roles.text, pageBackground);
          return (
            <button
              key={role}
              type="button"
              role="listitem"
              ref={(el) => {
                if (bandRefs) bandRefs.current[i] = el;
              }}
              onClick={() => onPick?.(role)}
              onPointerDown={() => onFocusRole?.(role)}
              onFocus={() => onFocusRole?.(role)}
              onBlur={() => onFocusRole?.(null)}
              aria-label={EMPTY_ROLE_COPY(role)}
              className="inzpo-band inzpo-band-empty"
              data-role={role}
              data-hex=""
              style={{
                height,
                color: emptyInk,
                transitionDuration: `${MOTION_CSS.tapMs}ms`,
              }}
            >
              {EMPTY_ROLE_COPY(role)}
            </button>
          );
        }
        const ink = bandLabelColor(hex, roles);
        const hair = matchesPageBackground(hex, pageBackground);
        return (
          <button
            key={role}
            type="button"
            role="listitem"
            ref={(el) => {
              if (bandRefs) bandRefs.current[i] = el;
            }}
            onClick={() => onPick?.(role)}
            onPointerDown={() => onFocusRole?.(role)}
            onFocus={() => onFocusRole?.(role)}
            onBlur={() => onFocusRole?.(null)}
            aria-label={`${role} ${hex}`}
            className="inzpo-band"
            data-role={role}
            data-hex={hex}
            style={{
              height,
              backgroundColor: hex,
              color: ink,
              boxShadow: hair ? `inset 0 0 0 1px ${PAGE_BAND_HAIRLINE}` : undefined,
              transitionDuration: `${MOTION_CSS.tapMs}ms`,
            }}
          >
            <span className="inzpo-band-role">
              {role}
            </span>
            <span className="inzpo-band-hex" data-swatch-hex>
              {hex}
            </span>
          </button>
        );
      })}
    </div>
  );
}
