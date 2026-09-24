import { LinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection } from 'lexical';
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
import { $createInternalLinkNode, $isInternalLinkNode, InternalLinkNode } from '../nodes/InternalLinkNode';
import type { PluginContext, PrimavistaPlugin, ToolbarApi, Translate } from '../types';

export interface InternalLinkProvider {
  /** Value of the `provider` attribute, for example `page` or `media`. */
  key: string;
  label: string;
}

export interface InternalLinkValues {
  /** Resource id. Becomes the href together with query and anchor. */
  href: string | number;
  query?: string | null;
  anchor?: string | null;
  target?: string | null;
  title?: string | null;
  /** Text to insert when nothing is selected. Defaults to the href. */
  text?: string;
}

export interface InternalLinkDialogState {
  mode: 'create' | 'edit';
  provider: string;
  /** Resource id without query and anchor. */
  href: string | null;
  query: string | null;
  anchor: string | null;
  target: string | null;
  title: string | null;
  selectedText: string;
  collapsed: boolean;
  apply: (values: InternalLinkValues) => void;
  remove: () => void;
  cancel: () => void;
}

export interface InternalLinksOptions {
  providers: ReadonlyArray<InternalLinkProvider>;
  /** Custom element name in the HTML. Defaults to `sulu-link`. */
  tag?: string;
  /** Attribute for the host's validation state. Defaults to `sulu-validation-state`. */
  validationAttribute?: string;
  /** Target for new links. Sulu writes `_self`. */
  defaultTarget?: string | null;
  /**
   * Opens the host's resource picker for the provider. Without it a plain
   * panel asks for the id, query, anchor and target.
   */
  openDialog?: (state: InternalLinkDialogState) => void;
  /** Label shown in the balloon. Defaults to `provider: href`. */
  describe?: (link: { provider: string; href: string }) => string;
}

/**
 * Links to CMS resources, stored as `<sulu-link href provider target title>`.
 * One toolbar menu entry per provider. The host resolves the ids when it
 * renders the page.
 */
export function internalLinks(options: InternalLinksOptions): PrimavistaPlugin {
  if (options.tag) InternalLinkNode.tagName = options.tag;
  if (options.validationAttribute) InternalLinkNode.validationAttribute = options.validationAttribute;
  let context: PluginContext | null = null;

  const open = (toolbar: ToolbarApi, mode: 'create' | 'edit', provider: string): void => {
    if (!context) return;
    const { editor, translate } = context;
    const state = editor.read(() => {
      const { link, selectedText, collapsed } = $readLinkSelection();
      const internal = $isInternalLinkNode(link) ? link : null;
      const parts = parseHref(internal?.getURL() ?? '');
      return {
        exists: internal !== null,
        provider: internal?.getProvider() ?? provider,
        href: internal ? parts.href : null,
        query: internal ? parts.query : null,
        anchor: internal ? parts.anchor : null,
        target: internal?.getTarget() ?? (mode === 'create' ? (options.defaultTarget ?? null) : null),
        title: internal?.getTitle() ?? null,
        selectedText,
        collapsed,
      };
    });
    if (mode === 'edit' && !state.exists) return;

    const finish = (): void => {
      toolbar.closePanel();
      context?.balloon.hide();
      editor.focus();
    };
    const apply = (values: InternalLinkValues): void => {
      const href = buildHref(values);
      if (href === '') return;
      editor.update(() => {
        const existing = $getLinkAtSelection();
        if (existing) $selectLink(existing);
        const links = $wrapSelectionInLink(
          { url: href, target: values.target ?? null, title: values.title ?? null, rel: null },
          values.text ?? String(values.href),
        );
        for (const link of links) {
          if ($isInternalLinkNode(link)) {
            link.setProvider(state.provider);
            link.setValidationState(null);
            continue;
          }
          const internal = $createInternalLinkNode(href, {
            provider: state.provider,
            target: values.target ?? null,
            title: values.title ?? null,
          });
          link.replace(internal, true);
        }
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
    const dialogState: InternalLinkDialogState = {
      mode,
      provider: state.provider,
      href: state.href,
      query: state.query,
      anchor: state.anchor,
      target: state.target,
      title: state.title,
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
    toolbar.openPanel((panel) => renderInternalLinkPanel(panel, dialogState, options.providers, translate));
  };

  const describe =
    options.describe ??
    ((link: { provider: string; href: string }): string => {
      const label = options.providers.find((p) => p.key === link.provider)?.label ?? link.provider;
      return `${label}: ${link.href}`;
    });

  return {
    name: 'internal-links',
    nodes: [LinkNode, InternalLinkNode],
    theme: { internalLink: 'pv-internal-link' },
    register(ctx) {
      context = ctx;
      const { editor, toolbar, balloon, container } = ctx;
      return mergeRegister(
        registerLinkBalloon(
          editor,
          balloon,
          container,
          (link) => {
            if (!$isInternalLinkNode(link)) return null;
            const provider = link.getProvider();
            return {
              label: { text: describe({ provider, href: link.getURL() }) },
              editLabel: ctx.translate('link.edit', 'Edit link'),
              removeLabel: ctx.translate('link.remove', 'Remove link'),
              edit: () => open(toolbar, 'edit', provider),
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
        type: 'menu',
        id: 'internal-link',
        label: 'Internal link',
        icon: icons.internalLink,
        group: 'links',
        options: options.providers.map((provider) => ({ value: provider.key, label: provider.label })),
        isDisabled: () => !$isRangeSelection($getSelection()) || $selectionTouchesLink(),
        onSelect: (provider, _editor, { toolbar }) => open(toolbar, 'create', provider),
      },
    ],
  };
}

const TARGET_LABELS: Record<string, string> = {
  _self: 'Same window',
  _blank: 'New window',
  _parent: 'Parent frame',
  _top: 'Top frame',
};

/** `uuid?query#anchor` into its parts, the way Sulu's LinkTag reads it. */
export function parseHref(href: string): { href: string; query: string | null; anchor: string | null } {
  const [beforeHash, anchor = null] = splitOnce(href, '#');
  const [id, query = null] = splitOnce(beforeHash, '?');
  return { href: id, query, anchor };
}

export function buildHref(values: { href: string | number; query?: string | null; anchor?: string | null }): string {
  const id = String(values.href).trim();
  if (id === '') return '';
  let result = id;
  const query = values.query?.replace(/^\?+/, '').trim();
  if (query) result += `?${query}`;
  const anchor = values.anchor?.replace(/^#+/, '').trim();
  if (anchor) result += `#${anchor}`;
  return result;
}

function splitOnce(value: string, separator: string): [string, string | null] {
  const index = value.indexOf(separator);
  if (index === -1) return [value, null];
  return [value.slice(0, index), value.slice(index + 1)];
}

function renderInternalLinkPanel(
  panel: HTMLElement,
  state: InternalLinkDialogState,
  providers: ReadonlyArray<InternalLinkProvider>,
  translate: Translate,
): void {
  const form = document.createElement('form');
  form.className = 'pv-link-form';

  const providerLabel = document.createElement('span');
  providerLabel.className = 'pv-form-label';
  const provider = providers.find((p) => p.key === state.provider);
  providerLabel.textContent = translate(`toolbar.internal-link.${state.provider}`, provider?.label ?? state.provider);
  form.appendChild(providerLabel);

  const href = field(translate('link.resource', 'Resource id'), state.href ?? '', translate('link.resource.placeholder', 'id'));
  const query = field(translate('link.query', 'Query'), state.query ?? '', translate('link.query.placeholder', 'query'));
  query.classList.add('pv-input--short');
  const anchor = field(translate('link.anchor', 'Anchor'), state.anchor ?? '', translate('link.anchor.placeholder', 'anchor'));
  anchor.classList.add('pv-input--short');
  const title = field(translate('link.title', 'Link title'), state.title ?? '', translate('link.title.placeholder', 'Title'));
  title.classList.add('pv-input--short');
  form.append(href, query, anchor, title);

  const target = document.createElement('select');
  target.className = 'pv-select';
  target.setAttribute('aria-label', translate('link.target', 'Link target'));
  for (const option of [
    { value: '', label: 'Same window' },
    { value: '_blank', label: 'New window' },
  ]) {
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
      href: href.value,
      query: query.value,
      anchor: anchor.value,
      target: target.value === '' ? null : target.value,
      title: title.value.trim() === '' ? null : title.value.trim(),
    });
  });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      state.cancel();
    }
  });

  panel.appendChild(form);
  href.focus();
  href.select();
}

function field(label: string, value: string, placeholder: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.className = 'pv-input';
  el.placeholder = placeholder;
  el.setAttribute('aria-label', label);
  el.value = value;
  return el;
}
