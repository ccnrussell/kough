import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { history } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { livePreview } from "./livePreview";
import { editorTheme } from "./codemirrorTheme";

interface DescriptionEditorProps {
  content: string;
  onSave: (markdown: string) => void;
}

export function DescriptionEditor({ content, onSave }: DescriptionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const lastExternalContent = useRef(content);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const md = update.state.doc.toString();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
          onSaveRef.current(md);
        }, 500);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        markdown(),
        history(),
        syntaxHighlighting(defaultHighlightStyle),
        editorTheme,
        livePreview,
        updateListener,
        EditorView.lineWrapping,
        EditorView.editable.of(true),
        EditorState.tabSize.of(2),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        onSaveRef.current(view.state.doc.toString());
      }
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content === lastExternalContent.current) return;

    const currentContent = view.state.doc.toString();
    if (content === currentContent) return;

    lastExternalContent.current = content;

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="cm-wrapper grow min-h-[200px] rounded-md border border-border bg-secondary/30 resize-y"
    />
  );
}
