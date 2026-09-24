import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND } from 'lexical';
import { icons } from '../icons';
import {
  $getLinkAtSelection,
  $readLinkSelection,
  $selectionTouchesLink,
  $selectLink,
  $unlinkSelection,
  $wrapSelectionInLink,
  registerLinkBalloon,
} from '../linkUtils';
import { $isInternalLinkNode } from '../nodes/InternalLinkNode';
import type { PluginContext, PrimavistaPlugin, ToolbarApi, Translate } from '../types';

export interface LinkValues {
  url: string;
  target?: string | null;
  title?: string | null;
  rel?: string | null;
  /** Text to insert when nothing is selected. Defaults to the URL. */
  text?: string;
}

export interface LinkDialogState {
  mode: 'create' | 'edit';
  url: string;
  target: string | null;
  title: string | null;
  rel: string | null;
  selectedText: string;
  /** True when nothing is selected: `apply` will insert the link text. */
  collapsed: boolean;
  apply: (values: LinkValues) => void;
  remove: () => void;
  cancel: () => void;
}

export interface LinksOptions {
  /** Return false to reject a URL. Defaults to rejecting `javascript:`. */
  validateUrl?: (url: string) => boolean;
  /** Target written for new links from the built-in panel. Sulu uses `_self`. */
  defaultTarget?: string | null;
  /**
   * Replaces the built-in panel. Host systems open their own dialog here and
   * call `apply`, `remove` or `cancel` when done.
   */
  openDialog?: (state: LinkDialogState) => void;
  /** Targets offered by the built-in panel. */
  targets?: ReadonlyArray<{ value: string; label: string }>;
}

const defaultValidateUrl = (url: string): boolean => !/^\s*javascript:/i.test(url);

const TARGET_LABELS: Record<string, string> = {
  _self: 'Same window',
  _blank: 'New window',
  _parent: 'Parent frame',
  _top: 'Top frame',
};

const DEFAULT_TARGETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Same window' },
  { value: '_blank', label: 'New window' },
];

/**
 * External links: `<a href target title rel>`. The toolbar button creates a
 * link, editing and removal happen in a balloon under the link. Registers
 * `TOGGLE_LINK_COMMAND` for programmatic use.
 */
export function links(options: LinksOptions = {}): PrimavistaPlugin {
  const validateUrl = options.validateUrl ?? defaultValidateUrl;
  const targets = options.targets ?? DEFAULT_TARGETS;
  let context: PluginContext | null = null;

  const open = (toolbar: ToolbarApi, mode: 'create' | 'edit'): void => {
    if (!context) return;
    const { editor, translate } = context;
    const state = editor.read(() => {
      const { link, selectedText, collapsed } = $readLinkSelection();
      const external = link && !$isInternalLinkNode(link) ? link : null;
      return {
        link: external,
        url: external?.getURL() ?? '',
        target: external?.getTarget() ?? (mode === 'create' ? (options.defaultTarget ?? null) : null),
        title: external?.getTitle() ?? null,
        rel: external?.getRel() ?? null,
        selectedText,
        collapsed,
      };
    });
    if (mode === 'edit' && !state.link) return;

    const finish = (): void => {
      toolbar.closePanel();
      context?.balloon.hide();
      editor.focus();
    };
    const apply = (values: LinkValues): void => {
      const url = values.url.trim();
      if (url === '' || !validateUrl(url)) return;
      editor.update(() => {
        const existing = $getLinkAtSelection();
        if (existing && !$isInternalLinkNode(existing)) $selectLink(existing);
        $wrapSelectionInLink(
          { url, target: values.target ?? null, title: values.title ?? null, rel: values.rel ?? null },
          values.text ?? url,
        );
      });
      finish();
    };
    const remove = (): void => {
      editor.update(() => {
        const existing = $getLinkAtSelection();
        if (existing) $selectLink(existing);
        $unlinkSelection();
      });
      finish();
    };
    const dialogState: LinkDialogState = {
      mode,
      url: state.url,
      target: state.target,
      title: state.title,
      rel: state.rel,
      selectedText: state.selectedText,
      collapsed: state.collapsed,
      apply,
      remove,
      cancel: finish,
    };
    if (options.openDialog) {
      options.openDialog(dialogState);
      return;
    }
    toolbar.openPanel((panel) => renderLinkPanel(panel, dialogState, targets, translate));
  };

  return {
    name: 'links',
    nodes: [LinkNode],
    register(ctx) {
      context = ctx;
      const { editor, toolbar, balloon, container } = ctx;
      return mergeRegister(
        editor.registerCommand(
          TOGGLE_LINK_COMMAND,
          (payload) => {
            if (payload === null) {
              $unlinkSelection();
              return true;
            }
            const attributes = typeof payload === 'string' ? { url: payload } : payload;
            if (!validateUrl(attributes.url)) return false;
            $wrapSelectionInLink({ ...attributes, rel: attributes.rel ?? null }, attributes.url);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          KEY_DOWN_COMMAND,
          (event) => {
            if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
              event.preventDefault();
              const inLink = editor.read(() => {
                const link = $getLinkAtSelection();
                return link !== null && !$isInternalLinkNode(link);
              });
              open(toolbar, inLink ? 'edit' : 'create');
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        registerLinkBalloon(
          editor,
          balloon,
          container,
          (link) => {
            if (!$isLinkNode(link) || $isInternalLinkNode(link)) return null;
            const url = link.getURL();
            return {
              label: { text: url, href: url },
              editLabel: ctx.translate('link.edit', 'Edit link'),
              removeLabel: ctx.translate('link.remove', 'Remove link'),
              edit: () => open(toolbar, 'edit'),
              remove: () => {
                editor.update(() => {
                  const existing = $getLinkAtSelection();
                  if (existing) $selectLink(existing);
                  $unlinkSelection();
                });
                balloon.hide();
                editor.focus();
              },
            };
          },
          { edit: icons.edit, remove: icons.unlink },
        ),
        () => {
          context = null;
        },
      );
    },
    toolbar: [
      {
        id: 'link',
        label: 'Link',
        shortcut: 'Ctrl+K',
        icon: icons.link,
        group: 'links',
        isDisabled: () => !$isRangeSelection($getSelection()) || $selectionTouchesLink(),
        onClick: (_editor, { toolbar }) => open(toolbar, 'create'),
      },
    ],
  };
}

function renderLinkPanel(
  panel: HTMLElement,
  state: LinkDialogState,
  targets: ReadonlyArray<{ value: string; label: string }>,
  translate: Translate,
): void {
  const form = document.createElement('form');
  form.className = 'pv-link-form';

  const url = input('url', translate('link.url', 'Link URL'), state.url, 'https://');
  form.appendChild(url);

  const target = document.createElement('select');
  target.className = 'pv-select';
  target.setAttribute('aria-label', translate('link.target', 'Link target'));
  for (const option of targets) {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = translate(`link.target.${option.value || 'default'}`, option.label);
    target.appendChild(el);
  }
  // Keep a target the host wrote (Sulu uses `_self`) even if the panel does not list it.
  if (state.target && !Array.from(target.options).some((option) => option.value === state.target)) {
    const el = document.createElement('option');
    el.value = state.target;
    el.textContent = translate(`link.target.${state.target}`, TARGET_LABELS[state.target] ?? state.target);
    target.appendChild(el);
  }
  target.value = state.target ?? '';
  form.appendChild(target);

  const title = input('text', translate('link.title', 'Link title'), state.title ?? '', translate('link.title.placeholder', 'Title'));
  title.classList.add('pv-input--short');
  form.appendChild(title);

  const apply = document.createElement('button');
  apply.type = 'submit';
  apply.className = 'pv-button pv-button--primary';
  apply.innerHTML = icons.check;
  apply.title = state.mode === 'edit' ? translate('link.update', 'Update link') : translate('link.add', 'Add link');
  apply.setAttribute('aria-label', apply.title);
  form.appendChild(apply);

  if (state.mode === 'edit') {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'pv-button';
    remove.innerHTML = icons.unlink;
    remove.title = translate('link.remove', 'Remove link');
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', state.remove);
    form.appendChild(remove);
  }

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pv-button';
  cancel.innerHTML = icons.close;
  cancel.title = translate('link.cancel', 'Cancel');
  cancel.setAttribute('aria-label', cancel.title);
  cancel.addEventListener('click', state.cancel);
  form.appendChild(cancel);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.apply({
      url: url.value,
      target: target.value === '' ? null : target.value,
      title: title.value.trim() === '' ? null : title.value.trim(),
      rel: state.rel,
    });
  });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      state.cancel();
    }
  });

  panel.appendChild(form);
  url.focus();
  url.select();
}

function input(type: string, label: string, value: string, placeholder: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  el.className = 'pv-input';
  el.placeholder = placeholder;
  el.setAttribute('aria-label', label);
  el.value = value;
  return el;
}
