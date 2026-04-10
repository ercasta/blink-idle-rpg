/**
 * Custom SVG icon components for Blink Idle RPG.
 *
 * Colour palette:
 *   – General UI icons: currentColor (inherits parent text colour)
 *   – Class icons use muted class colours (per issue spec: brownish palette,
 *     blue / red / green allowed but not too saturated, for class icons only)
 *   – Element icons: warm brown / amber tones
 */

import type { HeroClass } from '../../types';

export interface IconProps {
  size?: number;
  className?: string;
}

// ── Class colours ─────────────────────────────────────────────────────────────
const C = {
  warrior: '#b85454',   // muted red
  mage:    '#4a7fc0',   // muted blue
  ranger:  '#4a9060',   // muted green
  paladin: '#5a80b0',   // steel blue
  rogue:   '#8b5e3c',   // dark amber-brown
  cleric:  '#c8a850',   // warm gold
};

// ── Logo / Favicon ────────────────────────────────────────────────────────────

/** Shield with crossed swords — used as the app logo and favicon. */
export function LogoIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Shield */}
      <path d="M12 2L21 6.5V14C21 18.5 17 21.5 12 23C7 21.5 3 18.5 3 14V6.5Z"
        fill="#4a3020" stroke="#a07040" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Crossed swords (inside shield) */}
      <line x1="9" y1="9" x2="15" y2="16" stroke="#d4b48a" strokeWidth="1.75" strokeLinecap="round"/>
      <line x1="15" y1="9" x2="9" y2="16" stroke="#d4b48a" strokeWidth="1.75" strokeLinecap="round"/>
      {/* Tiny crossguards */}
      <line x1="8.2" y1="10.2" x2="9.8" y2="8.2" stroke="#d4b48a" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="14.2" y1="10.2" x2="15.8" y2="8.2" stroke="#d4b48a" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ── Class icons ───────────────────────────────────────────────────────────────

/** Warrior — sword with crossguard */
export function WarriorIcon({ size = 24, className = '' }: IconProps) {
  const c = C.warrior;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Blade */}
      <line x1="18" y1="3" x2="7" y2="18" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Crossguard */}
      <line x1="10.5" y1="8" x2="15" y2="12.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Handle */}
      <line x1="7" y1="18" x2="5.5" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Pommel */}
      <circle cx="4.8" cy="21.8" r="1.5" fill={c}/>
    </svg>
  );
}

/** Mage — wand with four-pointed star at tip */
export function MageIcon({ size = 24, className = '' }: IconProps) {
  const c = C.mage;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Wand */}
      <line x1="5" y1="20" x2="13" y2="11" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Wand grip marks */}
      <line x1="7" y1="19" x2="8.5" y2="17.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      {/* Four-pointed star at tip */}
      <path d="M17 5 L17.7 8.3 L21 9 L17.7 9.7 L17 13 L16.3 9.7 L13 9 L16.3 8.3 Z" fill={c}/>
    </svg>
  );
}

/** Ranger — bow with arrow */
export function RangerIcon({ size = 24, className = '' }: IconProps) {
  const c = C.ranger;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Bow curve (arcs left) */}
      <path d="M7 4 Q2.5 12 7 20" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Bowstring */}
      <line x1="7" y1="4" x2="7" y2="20" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
      {/* Arrow shaft */}
      <line x1="10" y1="12" x2="21" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Arrowhead */}
      <path d="M18 9.5 L21 12 L18 14.5" fill="none" stroke={c} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
      {/* Fletching */}
      <path d="M10 12 L12 10 M10 12 L12 14" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Paladin — kite shield with cross */
export function PaladinIcon({ size = 24, className = '' }: IconProps) {
  const c = C.paladin;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Shield body */}
      <path d="M12 3 L19 7 L19 14 C19 18 16 21 12 22.5 C8 21 5 18 5 14 L5 7 Z"
        fill="#1e3050" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Cross */}
      <line x1="12" y1="8.5" x2="12" y2="17.5" stroke="#d4b48a" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8.5" y1="13" x2="15.5" y2="13" stroke="#d4b48a" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/** Rogue — short dagger */
export function RogueIcon({ size = 24, className = '' }: IconProps) {
  const c = C.rogue;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Blade (shorter, steeper than warrior sword) */}
      <line x1="17" y1="5" x2="9" y2="18" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Small crossguard */}
      <line x1="12.5" y1="8" x2="16" y2="11" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Handle */}
      <line x1="9" y1="18" x2="7.5" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Pommel */}
      <circle cx="6.8" cy="21.8" r="1.5" fill={c}/>
      {/* Serration hint on blade */}
      <line x1="14" y1="10.5" x2="15" y2="9.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <line x1="12.5" y1="12.5" x2="13.5" y2="11.5" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}

/** Cleric — staff with sunburst */
export function ClericIcon({ size = 24, className = '' }: IconProps) {
  const c = C.cleric;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Staff */}
      <line x1="12" y1="22" x2="12" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      {/* Sun circle */}
      <circle cx="12" cy="8" r="3.5" fill="none" stroke={c} strokeWidth="1.5"/>
      {/* Cardinal rays */}
      <line x1="12" y1="3.5" x2="12" y2="2" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17.5" y1="8" x2="19" y2="8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6.5" y1="8" x2="5" y2="8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Diagonal rays */}
      <line x1="14.5" y1="5.5" x2="15.5" y2="4.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9.5" y1="5.5" x2="8.5" y2="4.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14.5" y1="10.5" x2="15.5" y2="11.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9.5" y1="10.5" x2="8.5" y2="11.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Dispatcher: renders the correct class icon for a given HeroClass. */
export function ClassIcon({ heroClass, size = 24, className = '' }: { heroClass: HeroClass } & IconProps) {
  const props = { size, className };
  switch (heroClass) {
    case 'Warrior': return <WarriorIcon {...props}/>;
    case 'Mage':    return <MageIcon    {...props}/>;
    case 'Ranger':  return <RangerIcon  {...props}/>;
    case 'Paladin': return <PaladinIcon {...props}/>;
    case 'Rogue':   return <RogueIcon   {...props}/>;
    case 'Cleric':  return <ClericIcon  {...props}/>;
  }
}

// ── Element / environment icons ───────────────────────────────────────────────

const EL = '#c8956a'; // base brown-amber for element icons

/** Physical — sword slash */
export function PhysicalIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <line x1="12" y1="2" x2="4" y2="12" stroke={EL} strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="5.5" x2="10" y2="7.5" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4" y1="12" x2="3" y2="14" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Magical — sparkle orb */
export function MagicalIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="4" fill="none" stroke={EL} strokeWidth="1.5"/>
      <line x1="8" y1="1" x2="8" y2="3" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="8" y2="15" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="8" x2="3" y2="8" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="8" x2="15" y2="8" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 5.5 L8.4 7.6 L10.5 8 L8.4 8.4 L8 10.5 L7.6 8.4 L5.5 8 L7.6 7.6 Z" fill={EL}/>
    </svg>
  );
}

/** Fire — flame */
export function FireIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={EL} className={className} aria-hidden="true">
      <path d="M8 1 C8 1 11 5 11 8 C11 9.5 10.3 10.5 9 11 C9.5 9.5 8.5 8.5 8 8 C8 8 7 10 7.5 12 C6 11 5 9.5 5 8 C5 5 8 1 8 1 Z"
        opacity="0.9"/>
      <path d="M8 8 C8 8 9.5 10 8.5 12.5 C7.5 14 6 14.5 5 13.5 C4 12.5 4 11 5 10 C5.5 11 6.5 11 7 10.5 C7 10.5 6.5 9 8 8 Z"
        opacity="0.7"/>
    </svg>
  );
}

/** Water — droplet */
export function WaterIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={EL} className={className} aria-hidden="true">
      <path d="M8 1.5 C8 1.5 3 7 3 10.5 C3 13 5.2 15 8 15 C10.8 15 13 13 13 10.5 C13 7 8 1.5 8 1.5 Z" opacity="0.9"/>
      <path d="M9.5 9 C10.5 9.5 11 10.5 10.5 11.5" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

/** Wind — swirl */
export function WindIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M2 8 Q5 8 7 7 Q11 5 11 3 Q11 1.5 9.5 1.5 Q8 1.5 8 3" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 10 Q5 10 7 11 Q9 12 10.5 12 Q13 12 13 10 Q13 8.5 11 8.5 L3 8.5" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Earth — mountain crystal */
export function EarthIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={EL} className={className} aria-hidden="true">
      <path d="M8 2 L14 13 L2 13 Z" opacity="0.9"/>
      <path d="M5.5 5.5 L3.5 9 L7.5 9 Z" fill="#4a3020" opacity="0.5"/>
    </svg>
  );
}

/** Light — sunburst */
export function LightIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill={EL}/>
      <line x1="8" y1="1" x2="8" y2="3" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="8" y2="15" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="8" x2="3" y2="8" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="8" x2="15" y2="8" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.1" y1="3.1" x2="4.5" y2="4.5" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11.5" y1="11.5" x2="12.9" y2="12.9" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.9" y1="3.1" x2="11.5" y2="4.5" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.5" y1="11.5" x2="3.1" y2="12.9" stroke={EL} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Darkness — crescent moon */
export function DarknessIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={EL} className={className} aria-hidden="true">
      <path d="M10 2 C6.5 2 4 4.7 4 8 C4 11.3 6.5 14 10 14 C11.5 14 12.8 13.5 13.8 12.5 C12.5 12.8 11 12.5 9.8 11.8 C7.8 10.6 6.5 8.5 6.5 6 C6.5 4.5 7 3.2 8 2.3 C8.6 2.1 9.3 2 10 2 Z"/>
    </svg>
  );
}

// ── Status / battle icons ─────────────────────────────────────────────────────

/** Crossed swords — battle / run header */
export function CrossedSwordsIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Sword 1 NW→SE */}
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="4" y1="7.5" x2="7.5" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Sword 2 NE→SW */}
      <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16.5" y1="4" x2="20" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Trophy — victory */
export function TrophyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Cup body */}
      <path d="M8 3 H16 L15 11 C15 14 13.5 16 12 16 C10.5 16 9 14 9 11 Z"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Handles */}
      <path d="M8 4 C5.5 4 5 6 5 8 C5 10 7 10.5 9 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 4 C18.5 4 19 6 19 8 C19 10 17 10.5 15 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Stem */}
      <line x1="12" y1="16" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Base */}
      <line x1="8.5" y1="21" x2="15.5" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Skull — enemies defeated / deaths */
export function SkullIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Head */}
      <path d="M12 3 C7.5 3 4.5 6.5 4.5 10.5 C4.5 13.5 6.5 16 9.5 17 L9.5 21 L14.5 21 L14.5 17 C17.5 16 19.5 13.5 19.5 10.5 C19.5 6.5 16.5 3 12 3 Z"
        fill="none" stroke="currentColor" strokeWidth="1.5"/>
      {/* Eyes */}
      <circle cx="9.5" cy="10.5" r="2" fill="currentColor"/>
      <circle cx="14.5" cy="10.5" r="2" fill="currentColor"/>
      {/* Nose */}
      <path d="M11 14 L12 15 L13 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      {/* Jaw */}
      <line x1="9.5" y1="21" x2="14.5" y2="21" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="11" y1="17.5" x2="11" y2="21" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="13" y1="17.5" x2="13" y2="21" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

/** Mountain — tier indicator */
export function MountainIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Mountain peak */}
      <path d="M12 3 L22 21 L2 21 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Snow cap */}
      <path d="M12 3 L15 10 L9 10 Z" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}

// ── Action / navigation icons ─────────────────────────────────────────────────

/** Play — start / replay */
export function PlayIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5 3.5 L5 20.5 L21 12 Z"/>
    </svg>
  );
}

/** Skip-to-end — skip to results */
export function SkipIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5 4 L5 20 L14 12 Z"/>
      <path d="M14 4 L14 20 L22 12 Z"/>
    </svg>
  );
}

/** Lightning bolt — quick play */
export function LightningIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 L7 13 L12 13 L11 22 L18 10 L13 10 Z"/>
    </svg>
  );
}

/** Dice (d6) — random / reroll */
export function DiceIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      {/* 5-dot face */}
      <circle cx="8" cy="8"  r="1.5" fill="currentColor"/>
      <circle cx="16" cy="8"  r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="8"  cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
    </svg>
  );
}

/** Folded map — adventures */
export function MapIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 6 L9 4 L15 7 L21 5 L21 19 L15 21 L9 18 L3 20 Z"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="9" y1="4" x2="9" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="15" y1="7" x2="15" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      {/* Pin marker */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

/** Two silhouettes — heroes roster */
export function HeroesIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Person 1 */}
      <circle cx="8" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 21 C2 16.5 4.7 14 8 14 C11.3 14 14 16.5 14 21"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Person 2 (overlapping right) */}
      <circle cx="16" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 21 C10 16.5 12.7 14 16 14 C19.3 14 22 16.5 22 21"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Scroll / clipboard — run history */
export function HistoryIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Document body */}
      <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      {/* Lines */}
      <line x1="8" y1="8"  x2="16" y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Circular arrows — reroll / random */
export function RerollIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M20 12 C20 16.4 16.4 20 12 20 C7.6 20 4 16.4 4 12 C4 7.6 7.6 4 12 4 L16 4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 2 L16 4 L14 6" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Crystal orb — predict / hero path */
export function CrystalIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Orb */}
      <circle cx="12" cy="11" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      {/* Sparkle inside */}
      <path d="M12 7 L12.5 10.5 L16 11 L12.5 11.5 L12 15 L11.5 11.5 L8 11 L11.5 10.5 Z"
        fill="currentColor" opacity="0.6"/>
      {/* Stand */}
      <line x1="9" y1="19.5" x2="15" y2="19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="18.5" x2="12" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Star — favourite */
export function StarIcon({ size = 24, filled = false, className = '' }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M12 2 L14.9 8.6 L22 9.3 L17 14 L18.5 21 L12 17.5 L5.5 21 L7 14 L2 9.3 L9.1 8.6 Z"
        strokeLinejoin="round"/>
    </svg>
  );
}

/** Download arrow */
export function DownloadIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3 L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 13 L12 17 L16 13" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/** Upload arrow (import) */
export function ImportIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 17 L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 7 L12 3 L16 7" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/** Trash can — delete */
export function TrashIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 6 L8 4 L16 4 L16 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 6 L7 21 L17 21 L18 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="10" y1="10" x2="10" y2="18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
      <line x1="14" y1="10" x2="14" y2="18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
    </svg>
  );
}

/** Group/party — party count */
export function PartyIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 22 C5 17 8 15 12 15 C16 15 19 17 19 22"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** Repeat / rerun */
export function RepeatIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M17 1 L21 5 L17 9" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 11 V9 C3 6.8 4.8 5 7 5 L21 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M7 23 L3 19 L7 15" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 13 V15 C21 17.2 19.2 19 17 19 L3 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ── Skill type icons ──────────────────────────────────────────────────────────

/** Active skill — lightning strike */
export function ActiveSkillIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9 1 L5 8.5 L8 8.5 L7 15 L12 7 L9 7 Z"/>
    </svg>
  );
}

/** Passive skill — shield */
export function PassiveSkillIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M8 1.5 L13.5 4 L13.5 9 C13.5 12 11 14.5 8 15.5 C5 14.5 2.5 12 2.5 9 L2.5 4 Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

/** Triggered skill — chain / diamond */
export function TriggeredSkillIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4 L8.4 6.6 L11 7 L8.4 7.4 L8 10 L7.6 7.4 L5 7 L7.6 6.6 Z" fill="currentColor"/>
    </svg>
  );
}

/** Skill type dispatcher */
export function SkillTypeIcon({ skillType, size = 16, className = '' }: { skillType: string } & IconProps) {
  const props = { size, className };
  switch (skillType) {
    case 'Active':    return <ActiveSkillIcon    {...props}/>;
    case 'Passive':   return <PassiveSkillIcon   {...props}/>;
    case 'Triggered': return <TriggeredSkillIcon {...props}/>;
    default:          return null;
  }
}
