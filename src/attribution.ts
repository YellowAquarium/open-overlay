import { MOD_ID } from './config';

const ELEMENT_ID = `${MOD_ID}-attribution`;

/** One credit line on the map, shared by the railway overlay and the satellite imagery. */
export class MapAttribution {
  private parts = new Map<string, string>();
  private element: HTMLElement | null = null;
  private container: HTMLElement | null = null;

  setContainer(container: HTMLElement | null): void {
    this.container = container;
    this.render();
  }

  set(key: string, html: string | null): void {
    if (html) this.parts.set(key, html);
    else this.parts.delete(key);
    this.render();
  }

  destroy(): void {
    this.parts.clear();
    this.element?.remove();
    this.element = null;
    this.container = null;
  }

  private render(): void {
    if (!this.container || !this.parts.size) {
      this.element?.remove();
      this.element = null;
      return;
    }
    if (!this.element || this.element.parentElement !== this.container) {
      this.element?.remove();
      const element = document.createElement('div');
      element.id = ELEMENT_ID;
      element.className = 'orm-attribution';
      element.addEventListener('click', (event) => {
        const link = (event.target as HTMLElement | null)?.closest?.('a');
        const electron = (window as unknown as { electron?: { openExternalUrl?: (url: string) => Promise<void> } }).electron;
        if (link && electron?.openExternalUrl) {
          event.preventDefault();
          void electron.openExternalUrl((link as HTMLAnchorElement).href).catch(() => undefined);
        }
      });
      this.container.appendChild(element);
      this.element = element;
    }
    this.element.innerHTML = [...this.parts.values()].join(' · ');
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
