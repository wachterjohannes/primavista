import type { LexicalEditor } from 'lexical';
import { icons } from './icons';
import type { ToolbarApi, ToolbarButton, ToolbarItem, ToolbarMenu, ToolbarSelect, Translate } from './types';

interface RenderedItem {
  item: ToolbarItem;
  element: HTMLButtonElement | HTMLSelectElement;
}

export interface Toolbar extends ToolbarApi {
  destroy(): void;
}

export function createToolbar(
  editor: LexicalEditor,
  items: ReadonlyArray<ToolbarItem>,
  host: HTMLElement,
  translate: Translate = (_key, fallback) => fallback,
): Toolbar {
  const bar = document.createElement('div');
  bar.className = 'pv-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', translate('toolbar.label', 'Formatting'));
  host.appendChild(bar);

  const panel = document.createElement('div');
  panel.className = 'pv-toolbar-panel';
  panel.hidden = true;
  host.appendChild(panel);

  let closeCurrentPanel: (() => void) | null = null;

  const api: ToolbarApi = {
    element: bar,
    refresh,
    openPanel(render) {
      api.closePanel();
      panel.innerHTML = '';
      panel.hidden = false;
      let closed = false;
      const close = (): void => {
        if (closed) return;
        closed = true;
        panel.hidden = true;
        panel.innerHTML = '';
        if (closeCurrentPanel === close) closeCurrentPanel = null;
      };
      closeCurrentPanel = close;
      render(panel, close);
      return close;
    },
    closePanel() {
      closeCurrentPanel?.();
    },
  };

  const rendered: RenderedItem[] = [];
  let previousGroup: string | undefined;
  items.forEach((item, index) => {
    if (index > 0 && item.group !== previousGroup) {
      const separator = document.createElement('span');
      separator.className = 'pv-toolbar-separator';
      separator.setAttribute('role', 'separator');
      bar.appendChild(separator);
    }
    previousGroup = item.group;
    const element = item.type === 'select' ? renderSelect(item) : item.type === 'menu' ? renderMenu(item) : renderButton(item);
    element.dataset['pvItem'] = item.id;
    element.tabIndex = rendered.length === 0 ? 0 : -1;
    bar.appendChild(element);
    rendered.push({ item, element });
  });

  function renderButton(item: ToolbarButton): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pv-button';
    const label = translate(`toolbar.${item.id}`, item.label);
    button.innerHTML = item.icon ?? escapeHtml(label);
    button.title = item.shortcut ? `${label} (${item.shortcut})` : label;
    button.setAttribute('aria-label', label);
    if (item.isActive) button.setAttribute('aria-pressed', 'false');
    // Keep the selection inside the editor while clicking.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      if (button.disabled) return;
      item.onClick(editor, { element: button, toolbar: api });
      refresh();
    });
    return button;
  }

  function renderSelect(item: ToolbarSelect): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'pv-select';
    const label = translate(`toolbar.${item.id}`, item.label);
    select.title = label;
    select.setAttribute('aria-label', label);
    for (const option of item.options) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = translate(`toolbar.${item.id}.${option.value}`, option.label);
      select.appendChild(el);
    }
    select.addEventListener('change', () => {
      item.onChange(select.value, editor, { element: select, toolbar: api });
      editor.focus();
      refresh();
    });
    return select;
  }

  let openMenu: { element: HTMLButtonElement; list: HTMLElement } | null = null;
  const closeMenu = (): void => {
    if (!openMenu) return;
    openMenu.list.remove();
    openMenu.element.setAttribute('aria-expanded', 'false');
    openMenu = null;
    document.removeEventListener('mousedown', onDocumentMouseDown, true);
  };
  function onDocumentMouseDown(event: MouseEvent): void {
    if (openMenu && !openMenu.list.contains(event.target as Node) && event.target !== openMenu.element) {
      closeMenu();
    }
  }

  function renderMenu(item: ToolbarMenu): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pv-button pv-button--menu';
    const label = translate(`toolbar.${item.id}`, item.label);
    button.innerHTML = `${item.icon ?? escapeHtml(label)}<span class="pv-button-caret">${icons.chevronDown}</span>`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (openMenu?.element === button) {
        closeMenu();
        return;
      }
      closeMenu();
      const list = document.createElement('div');
      list.className = 'pv-menu';
      list.setAttribute('role', 'menu');
      for (const option of item.options) {
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.className = 'pv-menu-item';
        entry.setAttribute('role', 'menuitem');
        entry.dataset['pvOption'] = option.value;
        entry.textContent = translate(`toolbar.${item.id}.${option.value}`, option.label);
        entry.addEventListener('mousedown', (event) => event.preventDefault());
        entry.addEventListener('click', () => {
          closeMenu();
          item.onSelect(option.value, editor, { element: button, toolbar: api });
          refresh();
        });
        list.appendChild(entry);
      }
      list.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu();
          button.focus();
        }
      });
      const rect = button.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      list.style.left = `${rect.left - barRect.left}px`;
      list.style.top = `${rect.bottom - barRect.top}px`;
      bar.appendChild(list);
      button.setAttribute('aria-expanded', 'true');
      openMenu = { element: button, list };
      document.addEventListener('mousedown', onDocumentMouseDown, true);
      (list.firstElementChild as HTMLElement | null)?.focus();
    });
    return button;
  }

  function refresh(): void {
    const editable = editor.isEditable();
    editor.read(() => {
      for (const { item, element } of rendered) {
        const hidden = item.isHidden?.() ?? false;
        element.hidden = hidden;
        const disabled = !editable || (item.isDisabled?.() ?? false);
        element.disabled = disabled;
        if (element instanceof HTMLSelectElement) {
          if (item.type === 'select') {
            const value = item.getValue();
            if (element.value !== value) element.value = value;
          }
          continue;
        }
        if (item.type !== 'select' && item.type !== 'menu' && item.isActive) {
          const active = item.isActive();
          element.setAttribute('aria-pressed', String(active));
          element.classList.toggle('pv-button--active', active);
        }
      }
    });
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const controls = rendered.map((r) => r.element).filter((el) => !el.hidden && !el.disabled);
    const current = controls.indexOf(document.activeElement as HTMLButtonElement | HTMLSelectElement);
    if (current === -1 || controls.length === 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = controls[(current + delta + controls.length) % controls.length];
    if (!next) return;
    for (const control of controls) control.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
  bar.addEventListener('keydown', onKeyDown);

  const unregisterUpdate = editor.registerUpdateListener(() => refresh());
  const unregisterEditable = editor.registerEditableListener(() => refresh());
  refresh();

  return {
    ...api,
    destroy() {
      closeMenu();
      api.closePanel();
      unregisterUpdate();
      unregisterEditable();
      bar.removeEventListener('keydown', onKeyDown);
      bar.remove();
      panel.remove();
    },
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
