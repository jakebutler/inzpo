"use client";

import type { MutableRefObject } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { BAND_H_EDITOR, BAND_H_RESULT, PAGE_BAND_HAIRLINE, PAPER } from "@/lib/brand";
import { bandLabelColor, matchesPageBackground } from "@/lib/contrast";
import { EMPTY_ROLE_COPY } from "@/lib/brief-copy";
import { AUTO_TAG } from "@/lib/derived-roles";
import { MOTION_CSS } from "@/lib/motion";
import type { RoleColors } from "@/lib/tokens";

export function PaletteBands({
  roles,
  size,
  pageBackground = PAPER,
  onPick,
  onFocusRole,
  bandRefs,
  autoRoles,
}: {
  roles: RoleColors;
  size: "result" | "editor";
  pageBackground?: string;
  onPick?: (role: ColorRole) => void;
  onFocusRole?: (role: ColorRole | null) => void;
  bandRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  autoRoles?: ReadonlySet<ColorRole> | ColorRole[];
}) {
  const height = size === "editor" ? BAND_H_EDITOR : BAND_H_RESULT;
  const auto = autoRoles instanceof Set ? autoRoles : new Set(autoRoles ?? []);
  return (
    <div className="inzpo-bands" data-bands={size} role="list">
      {COLOR_ROLES.map((role, i) => {
        const hex = roles[role];
        if (!hex) {
          const emptyInk = bandLabelColor(pageBackground, roles);
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
        const isAuto = auto.has(role);
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
            aria-label={isAuto ? `${role} ${AUTO_TAG} ${hex}` : `${role} ${hex}`}
            className="inzpo-band"
            data-role={role}
            data-auto={isAuto ? "true" : undefined}
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
              {isAuto ? (
                <span className="inzpo-band-auto" data-auto-tag>
                  {AUTO_TAG}
                </span>
              ) : null}
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
