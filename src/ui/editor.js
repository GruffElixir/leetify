import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
const languages = { cpp, python, java, javascript };
export function createEditor({
  parent,
  language = 'cpp',
  code = '',
  settings,
  onChange = () => {},
  onCursor = () => {},
}) {
  const appearance = new Compartment();
  const languageConfig = new Compartment();
  const wrapping = new Compartment();
  const documents = new Map();
  let current = 'initial';
  let silent = false;
  let config = settings;
  const palette = () =>
    config.theme === 'light'
      ? {
          keyword: '#b044b8',
          string: '#39774c',
          number: '#ad672c',
          comment: '#737e8b',
          variable: '#2b6b9b',
        }
      : config.theme === 'monokai'
        ? {
            keyword: '#f92672',
            string: '#e6db74',
            number: '#ae81ff',
            comment: '#909783',
            variable: '#66d9ef',
          }
        : {
            keyword: '#c792ea',
            string: '#b9d995',
            number: '#f3b773',
            comment: '#747f91',
            variable: '#8dcce8',
          };
  // Each EditorView.theme() call mounts new style rules, so reuse one per appearance.
  const themes = new Map();
  function theme() {
    const key = `${config.theme}:${config.fontSize}`;
    if (!themes.has(key)) themes.set(key, buildTheme());
    return themes.get(key);
  }
  function buildTheme() {
    const colors = palette();
    return [
      EditorView.theme(
        {
          '&': {
            height: '100%',
            fontSize: `${config.fontSize}px`,
            backgroundColor: 'var(--lf-editor)',
            color: 'var(--lf-text)',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'Consolas, "Cascadia Code", "SFMono-Regular", monospace',
            lineHeight: '1.65',
          },
          '.cm-content': { padding: '16px 0' },
          '.cm-line': { padding: '0 18px' },
          '.cm-gutters': {
            backgroundColor: 'var(--lf-editor)',
            color: 'var(--lf-muted)',
            border: 'none',
          },
          '.cm-activeLine,.cm-activeLineGutter': { backgroundColor: 'var(--lf-hover)' },
          '.cm-cursor': { borderLeftColor: 'var(--lf-text)' },
          '.cm-selectionBackground': { backgroundColor: 'var(--lf-selection) !important' },
          '.cm-panels': {
            backgroundColor: 'var(--lf-surface)',
            color: 'var(--lf-text)',
            borderColor: 'var(--lf-border)',
          },
          '.cm-tooltip': {
            backgroundColor: 'var(--lf-surface)',
            color: 'var(--lf-text)',
            borderColor: 'var(--lf-border)',
          },
        },
        { dark: config.theme !== 'light' }
      ),
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: tags.keyword, color: colors.keyword },
          { tag: [tags.string, tags.special(tags.string)], color: colors.string },
          { tag: [tags.number, tags.bool], color: colors.number },
          { tag: [tags.comment], color: colors.comment, fontStyle: 'italic' },
          { tag: [tags.function(tags.variableName), tags.typeName], color: colors.variable },
        ])
      ),
    ];
  }
  function state(lang, source) {
    return EditorState.create({
      doc: source,
      extensions: [
        keymap.of([
          { key: 'Mod-Shift-z', run: redo },
          indentWithTab,
          // Run/Submit shortcuts bubble to the workspace; claim them so basicSetup inserts nothing.
          { key: 'Mod-Enter', run: () => true },
          { key: 'Mod-Shift-Enter', run: () => true },
        ]),
        basicSetup,
        EditorState.tabSize.of(4),
        indentUnit.of('    '),
        languageConfig.of((languages[lang] || cpp)()),
        appearance.of(theme()),
        wrapping.of(config.wrap ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({ 'aria-label': 'Solution editor', spellcheck: 'false' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !silent) onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursor({ line: line.number, column: head - line.from + 1 });
          }
        }),
      ],
    });
  }
  const view = new EditorView({ state: state(language, code), parent });
  function configure(next) {
    config = next;
    silent = true;
    try {
      view.dispatch({
        effects: [
          appearance.reconfigure(theme()),
          wrapping.reconfigure(config.wrap ? EditorView.lineWrapping : []),
        ],
      });
    } finally {
      silent = false;
    }
  }
  return {
    view,
    getCode: () => view.state.doc.toString(),
    setDocument({ key, language, code }) {
      documents.set(current, view.state);
      while (documents.size > 20) documents.delete(documents.keys().next().value);
      current = `${key}:${language}`;
      const cached = documents.get(current);
      silent = true;
      try {
        view.setState(cached?.doc.toString() === code ? cached : state(language, code));
        view.dispatch({ effects: languageConfig.reconfigure((languages[language] || cpp)()) });
        configure(config);
      } finally {
        silent = false;
      }
    },
    configure,
    focus: () => view.focus(),
    undo: () => undo(view),
    redo: () => redo(view),
    dispose: () => {
      documents.clear();
      view.destroy();
    },
  };
}
