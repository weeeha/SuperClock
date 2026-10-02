import type { ReactNode } from 'react';
import { C, useTextWidth } from './fields-util';

// Shared building blocks for Fields-skin screens (src/shared/skins.ts), drawn
// in a 1080 viewBox to the Figma frames (SupeClock-Design, "4B v2 · Watch
// quality"). Each app passes its own role names as literal strings, so the
// token-liveness gate can see which --fields-<app>* roles have a reader.

export interface FieldsRoles {
  /** The disc: the app's category hue by day, black at night. */
  field: string;
  /** Primary ink on the disc and on the panel. */
  ink: string;
  /** Secondary ink, on the disc only (it does not reach 4.5:1 on the panel). */
  soft: string;
  /** The rounded platter that holds lists and rows. */
  panel: string;
}


/** The round screen: the disc, the content, and the pager dots. */
export function FieldsDisc({ roles, summary, page, pageCount, children }: {
  roles: FieldsRoles;
  summary: string;
  page: number;
  pageCount: number;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 1080 1080" className="h-full w-full" role="img" aria-label={summary}>
      <circle cx={C} cy={C} r={C} style={{ fill: roles.field }} />
      {children}
      {pageCount > 1 && (
        <g>
          {Array.from({ length: pageCount }, (_, i) => (
            <circle key={i} cx={C + (i - (pageCount - 1) / 2) * 22} cy={968} r={6}
                    opacity={i === page ? 1 : 0.35} style={{ fill: roles.ink }} />
          ))}
        </g>
      )}
    </svg>
  );
}

/** Title row at the top: an optional lead mark and the title, centred
 *  together. `lead` draws the mark with its left edge at x0. */
export function TitleRow({ roles, title, leadWidth = 0, lead }: {
  roles: FieldsRoles;
  title: string;
  leadWidth?: number;
  lead?: (x0: number) => ReactNode;
}) {
  const [ref, width] = useTextWidth(title);
  const x0 = C - (leadWidth + width) / 2;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      {lead?.(x0)}
      <text ref={ref} x={x0 + leadWidth} y={142} dominantBaseline="central" fontSize="44" fontWeight={800}
            className="font-fields-num" style={{ fill: roles.ink }}>
        {title}
      </text>
    </g>
  );
}

/** Black 56 line, centred. */
export function Headline({ roles, y = 524, children }: { roles: FieldsRoles; y?: number; children: string }) {
  return (
    <text x={C} y={y} textAnchor="middle" dominantBaseline="central" fontSize="56" fontWeight={900}
          className="font-fields-num" style={{ fill: roles.ink }}>
      {children}
    </text>
  );
}

/** ExtraBold 40 line in the soft ink, centred. Disc only, never on the panel. */
export function Subline({ roles, y = 579, children }: { roles: FieldsRoles; y?: number; children: string }) {
  return (
    <text x={C} y={y} textAnchor="middle" dominantBaseline="central" fontSize="40" fontWeight={800}
          className="font-fields-num" style={{ fill: roles.soft, whiteSpace: 'pre' }}>
      {children}
    </text>
  );
}

/** Outline chip: the stale tell. Never a new hue. Centred on `cy`. */
export function OutlineChip({ roles, text, cy = 627 }: { roles: FieldsRoles; text: string; cy?: number }) {
  const [ref, width] = useTextWidth(text);
  const w = width + 56;
  return (
    <g opacity={width > 0 ? 1 : 0}>
      <rect x={C - w / 2} y={cy - 29} width={w} height={58} rx={29} fill="none" strokeWidth={3}
            style={{ stroke: roles.ink }} />
      <text ref={ref} x={C} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="30"
            fontWeight={800} className="font-fields-num" style={{ fill: roles.ink }}>
        {text}
      </text>
    </g>
  );
}

/** A lucide glyph in the hero slot, for screens with nothing to show. */
export function HeroGlyph({ roles, children }: { roles: FieldsRoles; children: ReactNode }) {
  return <g style={{ color: roles.ink }}>{children}</g>;
}
