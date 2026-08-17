import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { linter, type Diagnostic } from '@codemirror/lint';
import { mermaid as mermaidLang } from 'codemirror-lang-mermaid';
import { validate, errorLine, errorMessage } from './render';

export interface EditorHandles {
  view: EditorView;
  getCode: () => string;
  setCode: (code: string) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialCode: string,
  callbacks: {
    onChange: (code: string) => void;
    onRenderNow: () => void;
    getTheme: () => string;
  },
): EditorHandles {
  const mermaidLinter = linter(
    async (view): Promise<Diagnostic[]> => {
      const code = view.state.doc.toString();
      if (!code.trim()) return [];
      try {
        await validate(code, callbacks.getTheme());
        return [];
      } catch (err) {
        const line = errorLine(err, code) ?? 1;
        const docLine = view.state.doc.line(Math.min(line, view.state.doc.lines));
        return [
          {
            from: docLine.from,
            to: docLine.to,
            severity: 'error',
            message: errorMessage(err),
          },
        ];
      }
    },
    { delay: 400 },
  );

  const view = new EditorView({
    parent,
    doc: initialCode,
    extensions: [
      Prec.highest(
        keymap.of([
          {
            key: 'Ctrl-Enter',
            mac: 'Cmd-Enter',
            run: () => {
              callbacks.onRenderNow();
              return true;
            },
          },
        ]),
      ),
      basicSetup,
      keymap.of([indentWithTab]),
      mermaidLang(),
      mermaidLinter,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.onChange(update.state.doc.toString());
      }),
    ],
  });

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (code: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
  };
}
