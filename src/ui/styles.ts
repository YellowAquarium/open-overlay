const STYLE_ID = 'open-overlay-stylesheet';

export function injectOverlayStyles(): void {
  const style = document.getElementById(STYLE_ID) ?? document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .orm-panel {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      width: 100%;
      height: 100%;
      max-height: min(100%, calc(100vh - 96px));
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      font-size: 12px;
    }
    .orm-section {
      border: 1px solid hsl(var(--border));
      background: hsl(var(--background) / 0.45);
      border-radius: 8px;
      flex: 0 0 auto;
    }
    .orm-section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 10px;
      background: hsl(var(--muted) / 0.24);
      border-radius: 8px;
    }
    .orm-section-header:hover { background: hsl(var(--accent) / 0.42); }
    .orm-section-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-top: 1px solid hsl(var(--border) / 0.75);
    }
    .orm-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .orm-label { font-size: 12px; font-weight: 600; color: hsl(var(--foreground)); }
    .orm-muted { color: hsl(var(--muted-foreground)); }
    .orm-select, .orm-input {
      width: 100%;
      height: 30px;
      border-radius: 6px;
      border: 1px solid hsl(var(--border));
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      padding: 0 8px;
      font-size: 12px;
    }
    .orm-select option { background: hsl(var(--background)); color: hsl(var(--foreground)); }
    .orm-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .orm-chip {
      border-radius: 999px;
      border: 1px solid hsl(var(--border));
      background: hsl(var(--muted) / 0.32);
      color: hsl(var(--muted-foreground));
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .orm-chip:hover { border-color: hsl(var(--primary) / 0.7); color: hsl(var(--foreground)); }
    .orm-chip[data-on="true"] {
      border-color: hsl(var(--primary));
      background: hsl(var(--primary) / 0.18);
      color: hsl(var(--foreground));
    }
    .orm-swatch { width: 9px; height: 9px; border-radius: 50%; border: 1px solid hsl(var(--border)); }
    .orm-toggle {
      position: relative;
      width: 36px;
      height: 20px;
      flex: 0 0 auto;
      border-radius: 999px;
      border: 1px solid hsl(var(--border));
      background: hsl(var(--muted));
      cursor: pointer;
      transition: background-color 120ms ease;
    }
    .orm-toggle[data-on="true"] { background: hsl(var(--primary)); border-color: hsl(var(--primary)); }
    .orm-toggle[disabled] { opacity: 0.45; cursor: not-allowed; }
    .orm-toggle-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: hsl(var(--background));
      transition: transform 120ms ease;
    }
    .orm-toggle[data-on="true"] .orm-toggle-thumb { transform: translateX(16px); }
    .orm-range { width: 100%; height: 6px; border-radius: 999px; appearance: none; cursor: pointer; }
    .orm-range::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: hsl(var(--primary));
      border: 2px solid hsl(var(--background));
    }
    .orm-warning {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px;
      border: 1px solid hsl(38 92% 50% / 0.7);
      border-radius: 8px;
      background: hsl(38 92% 50% / 0.12);
      line-height: 1.4;
    }
    .orm-link {
      border: 0;
      background: transparent;
      padding: 0;
      font: inherit;
      color: hsl(var(--primary));
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .orm-feature {
      border: 1px solid hsl(var(--border) / 0.8);
      border-radius: 6px;
      padding: 7px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .orm-props {
      display: grid;
      grid-template-columns: minmax(80px, 38%) 1fr;
      gap: 2px 8px;
      font-size: 11px;
      word-break: break-word;
    }
    .orm-props dt { color: hsl(var(--muted-foreground)); }
    .orm-props dd { margin: 0; }
    .orm-result {
      text-align: left;
      border: 0;
      background: transparent;
      padding: 5px 6px;
      border-radius: 6px;
      color: hsl(var(--foreground));
      cursor: pointer;
    }
    .orm-result:hover { background: hsl(var(--accent) / 0.5); }
    .orm-attribution {
      position: absolute;
      left: 8px;
      bottom: 6px;
      z-index: 2;
      max-width: calc(100% - 16px);
      padding: 2px 7px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.78);
      color: #222;
      font: 11px/1.4 system-ui, sans-serif;
      pointer-events: auto;
    }
    .orm-attribution a { color: #1d4ed8; text-decoration: none; }
    .dark .orm-attribution { background: rgba(20, 20, 20, 0.72); color: #ddd; }
    .dark .orm-attribution a { color: #93c5fd; }
  `;
  if (!style.parentElement) document.head.appendChild(style);
}
