# @primavista/react

React binding for `@primavista/core`. A thin mount wrapper with the contract Sulu Admin expects from a field type.

```tsx
import { Editor } from '@primavista/react';
import '@primavista/core/primavista.css';

function Body({ value, onChange, onBlur }) {
  return <Editor value={value} onChange={onChange} onBlur={onBlur} placeholder="Write…" />;
}
```

Props: `value`, `defaultValue`, `onChange(html)`, `onBlur()`, `onFocus()`, `plugins`, `placeholder`, `disabled`, `className`, `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `onReady(editor)`.

`plugins` is read once on mount. Use a `key` to remount with a different set. The `ref` exposes `editor`, `focus()`, `getHtml()` and `setHtml()`.

Registering it in Sulu Admin:

```js
import { fieldRegistry } from 'sulu-admin-bundle/containers';
import { Editor } from '@primavista/react';

fieldRegistry.add('primavista', ({ value, onChange, onBlur, disabled }) => (
  <Editor value={value ?? ''} onChange={onChange} onBlur={onBlur} disabled={disabled} />
));
```
