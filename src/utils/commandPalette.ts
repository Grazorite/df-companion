/**
 * Shared contract for opening the global Command palette from anywhere in the
 * app (e.g. the navigation search button) without threading a callback or
 * context provider through the tree. `CommandPalette` listens for this event.
 */
export const COMMAND_PALETTE_OPEN_EVENT = 'df:open-command-palette'

export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
}
