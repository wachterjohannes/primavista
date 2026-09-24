import {
  alignment,
  Editor,
  formatting,
  headings,
  history,
  internalLinks,
  links,
  lists,
  suluPreset,
  tables,
  type InternalLinkDialogState,
  type PrimavistaEditor,
  type PrimavistaPlugin,
} from '@primavista/react';
import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Stand-in for Sulu's resource lists. */
const RESOURCES: Record<string, Array<{ id: string; title: string }>> = {
  page: [
    { id: 'uuid-home', title: 'Home' },
    { id: 'uuid-about', title: 'About us' },
    { id: 'uuid-contact', title: 'Contact' },
  ],
  media: [
    { id: '101', title: 'Brochure.pdf' },
    { id: '102', title: 'Logo.svg' },
  ],
};

/**
 * Mirrors how Sulu Admin would use the field: a controlled component with
 * value, onChange and onBlur, and the host's own overlay for internal links.
 */
function SuluLikeField({ initialHtml }: { initialHtml: string }) {
  const [value, setValue] = useState(initialHtml);
  const [blurCount, setBlurCount] = useState(0);
  const [dialog, setDialog] = useState<InternalLinkDialogState | null>(null);
  const editorRef = useRef<PrimavistaEditor | null>(null);

  const plugins = useMemo<PrimavistaPlugin[]>(
    () => [
      history(),
      formatting(),
      headings({ levels: ['h2', 'h3', 'h4', 'h5', 'h6'] }),
      lists(),
      links({ defaultTarget: '_self' }),
      internalLinks({
        providers: [
          { key: 'page', label: 'Page' },
          { key: 'media', label: 'Media' },
        ],
        defaultTarget: '_self',
        openDialog: (state) => setDialog(state),
        describe: ({ provider, href }) => {
          const id = href.split(/[?#]/)[0];
          const item = RESOURCES[provider]?.find((r) => r.id === id);
          return item ? `${provider}: ${item.title}` : `${provider}: ${href}`;
        },
      }),
      alignment(),
      tables(),
    ],
    [],
  );

  return (
    <div className="stack">
      <Editor
        value={value}
        onChange={setValue}
        onBlur={() => setBlurCount((count) => count + 1)}
        onReady={(editor) => {
          editorRef.current = editor;
        }}
        plugins={plugins}
        placeholder="React editor, same core"
        aria-label="React editor"
        {...suluPreset()}
      />
      <div className="row">
        <button type="button" data-testid="react-set-value" onClick={() => setValue('<h2>Set from outside</h2><p>Controlled value.</p>')}>
          Set value from outside
        </button>
        <button type="button" data-testid="react-clear" onClick={() => setValue('')}>
          Clear
        </button>
        <span data-testid="react-blur-count">blur: {blurCount}</span>
      </div>
      <pre data-testid="react-output">{value}</pre>
      {dialog && <InternalLinkDialog state={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** The host's overlay. Sulu renders its LinkTypeOverlay with a resource list here. */
function InternalLinkDialog({ state, onClose }: { state: InternalLinkDialogState; onClose: () => void }) {
  const items = RESOURCES[state.provider] ?? [];
  const [id, setId] = useState(state.href ?? items[0]?.id ?? '');
  const [anchor, setAnchor] = useState(state.anchor ?? '');
  const [target, setTarget] = useState(state.target ?? '_self');
  const item = items.find((r) => r.id === id);

  return (
    <div className="modal-backdrop" data-testid="react-link-dialog">
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault();
          state.apply({ href: id, anchor, target, title: item?.title ?? null, text: item?.title ?? id });
          onClose();
        }}
      >
        <h3>{state.mode === 'edit' ? 'Edit' : 'Insert'} {state.provider} link</h3>
        <label>
          Resource
          <select value={id} onChange={(event) => setId(event.target.value)} data-testid="react-link-resource">
            {items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Anchor
          <input value={anchor} onChange={(event) => setAnchor(event.target.value)} data-testid="react-link-anchor" />
        </label>
        <label>
          Target
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="_self">Same window</option>
            <option value="_blank">New window</option>
          </select>
        </label>
        <div className="row">
          <button type="submit" className="primary" data-testid="react-link-confirm">
            Confirm
          </button>
          {state.mode === 'edit' && (
            <button
              type="button"
              onClick={() => {
                state.remove();
                onClose();
              }}
            >
              Remove link
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              state.cancel();
              onClose();
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const host = document.getElementById('react-editor');
if (host) {
  createRoot(host).render(<SuluLikeField initialHtml={host.dataset['initialHtml'] ?? ''} />);
}
