/*
 * Demonstrates the plugin system across the Stimulus boundary. The app adds
 * internal links with its own providers and a highlight button without
 * touching the bundle. The event hands over the core module, so the plugin
 * uses the same Lexical instance as the editor.
 */
document.addEventListener('primavista:pre-connect', (event) => {
    const { plugins, core } = event.detail;
    const { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } = core.lexical;

    // Sulu registers one provider per link type: pages, media, articles, contacts.
    plugins.push(core.internalLinks({
        providers: [
            { key: 'page', label: 'Page' },
            { key: 'media', label: 'Media' },
        ],
        defaultTarget: '_self',
    }));

    plugins.push({
        name: 'demo-highlight',
        toolbar: [
            {
                id: 'highlight',
                label: 'Highlight',
                icon: 'H',
                group: 'demo',
                isActive: () => {
                    const selection = $getSelection();
                    return $isRangeSelection(selection) && selection.hasFormat('highlight');
                },
                onClick: (editor) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight'),
            },
        ],
    });
});

document.addEventListener('primavista:connect', (event) => {
    const { editor, textarea } = event.detail;
    const output = document.querySelector(`[data-live-output-for="${textarea.id}"]`);
    if (!output) {
        return;
    }
    output.textContent = editor.getHtml();
    editor.on('change', (html) => {
        output.textContent = html;
    });
});
