export interface Element {
  code: string      // "ICE", "FIR", "DAR"
  name: string      // "Ice Element", "Fire Element"
  shortName: string // "Ice", "Fire", "Darkness"
  colour: string    // Tailwind classes e.g. "bg-sky-500/20 text-sky-300"
}

/** Traits are behaviour markers, distinct from elements — [SHR], [W/S], [A/C], [ALA], [N/A] */
export interface Trait {
  code: string      // "SHR", "W/S", "A/C", "ALA", "N/A"
  name: string      // "Shrinks", "Weakness Seeks", etc.
  colour: string    // Tailwind classes
}

export interface ElementsData {
  elements: Element[]
  traits: Trait[]   // renamed from "markers" — these are behavioural traits, not element markers
}
