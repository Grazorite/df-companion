export interface Element {
  code: string      // "ICE", "FIR", "DAR"
  name: string      // "Ice Element", "Fire Element"
  shortName: string // "Ice", "Fire", "Darkness"
  colour: string    // Tailwind classes e.g. "bg-sky-500/20 text-sky-300"
}

export interface SpecialMarker {
  code: string      // "SHR", "W/S", "A/C", "ALA", "N/A"
  name: string      // "Shrinks", "Weakness Seeks", etc.
  colour: string    // Tailwind classes
}

export interface ElementsData {
  elements: Element[]
  markers: SpecialMarker[]
}
