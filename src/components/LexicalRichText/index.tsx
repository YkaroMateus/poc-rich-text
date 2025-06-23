import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $getRoot,
  $getSelection,
  $isTextNode,
  ParagraphNode,
  TextNode,
  isHTMLElement,
  type DOMConversionMap,
  type DOMExportOutput,
  type DOMExportOutputMap,
  type EditorState,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";

import { useEffect, useRef, useState } from "react";
import { MentionNode } from "./nodes/MentionNode";
import MentionsPlugin from "./plugins/MentionsPlugin";
import ToolbarPlugin from "./plugins/ToolbarPlugin";
import { parseAllowedColor, parseAllowedFontSize } from "./styleConfig";
import theme from "./theme";

import emojisData from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

const placeholder = "Enter some rich text...";

const removeStylesExportDOM = (
  editor: LexicalEditor,
  target: LexicalNode
): DOMExportOutput => {
  const output = target.exportDOM(editor);
  if (output && isHTMLElement(output.element)) {
    for (const el of [
      output.element,
      ...output.element.querySelectorAll('[style],[class],[dir="ltr"]'),
    ]) {
      el.removeAttribute("class");
      el.removeAttribute("style");
      if (el.getAttribute("dir") === "ltr") {
        el.removeAttribute("dir");
      }
    }
  }
  return output;
};

const exportMap: DOMExportOutputMap = new Map<
  Klass<LexicalNode>,
  (editor: LexicalEditor, target: LexicalNode) => DOMExportOutput
>([
  [ParagraphNode, removeStylesExportDOM],
  [TextNode, removeStylesExportDOM],
]);

const getExtraStyles = (element: HTMLElement): string => {
  let extraStyles = "";
  const fontSize = parseAllowedFontSize(element.style.fontSize);
  const backgroundColor = parseAllowedColor(element.style.backgroundColor);
  const color = parseAllowedColor(element.style.color);
  if (fontSize !== "" && fontSize !== "15px") {
    extraStyles += `font-size: ${fontSize};`;
  }
  if (backgroundColor !== "" && backgroundColor !== "rgb(255, 255, 255)") {
    extraStyles += `background-color: ${backgroundColor};`;
  }
  if (color !== "" && color !== "rgb(0, 0, 0)") {
    extraStyles += `color: ${color};`;
  }
  return extraStyles;
};

const constructImportMap = (): DOMConversionMap => {
  const importMap: DOMConversionMap = {};

  for (const [tag, fn] of Object.entries(TextNode.importDOM() || {})) {
    importMap[tag] = (importNode) => {
      const importer = fn(importNode);
      if (!importer) {
        return null;
      }
      return {
        ...importer,
        conversion: (element) => {
          const output = importer.conversion(element);
          if (
            output === null ||
            output.forChild === undefined ||
            output.after !== undefined ||
            output.node !== null
          ) {
            return output;
          }
          const extraStyles = getExtraStyles(element);
          if (extraStyles) {
            const { forChild } = output;
            return {
              ...output,
              forChild: (child, parent) => {
                const textNode = forChild(child, parent);
                if ($isTextNode(textNode)) {
                  textNode.setStyle(textNode.getStyle() + extraStyles);
                }
                return textNode;
              },
            };
          }
          return output;
        },
      };
    };
  }

  return importMap;
};

const bannedEmojis = ["middle_finger", "hankey"];
const mapEmojiLocale = {
  "pt-BR": "pt",
  "en-US": "en",
  "es-ES": "es",
};

const editorConfig = {
  html: {
    export: exportMap,
    import: constructImportMap(),
  },
  namespace: "React.js Demo",
  nodes: [ParagraphNode, TextNode, MentionNode],
  onError(error: Error) {
    throw error;
  },
  theme,
};

const LexicalRichText = ({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) => {
  const [openMenu, setOpenMenu] = useState("");
  const editorRef = useRef<LexicalEditor | null>(null);
  const initialStateSet = useRef(false);

  // Função para converter o HTML para o estado do editor
  const importHTML = (editor: LexicalEditor, html: string) => {
    editor.update(() => {
      if (html) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(html, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        nodes.forEach((node) => root.append(node));
      }
    });
  };

  const exportHTML = (state: EditorState) => {
    return state.read(() => {
      return $generateHtmlFromNodes(editorRef.current!, null);
    });
  };

  useEffect(() => {
    if (editorRef.current && value && !initialStateSet.current) {
      importHTML(editorRef.current, value);
      initialStateSet.current = true;
    }
  }, [value]);

  const selectEmoji = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpenMenu("emoji");
  };

  const handleSelectEmoji = (emoji: any) => {
    if (!bannedEmojis.includes(emoji.id)) {
      const editor = editorRef.current;
      if (editor) {
        editor.update(() => {
          const selection = $getSelection();
          if (selection) {
            selection.insertText(emoji.native);
          }
        });
      }
      setOpenMenu("");
    }
  };

  const handleUploadFile = () => {
    setOpenMenu("");
  };

  const handleMention = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.update(() => {
        const selection = $getSelection();
        if (selection) {
          selection.insertText("@");
        }
      });
    }
  };

  return (
    <div
      style={{
        gap: "1rem",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <h1 style={{ textAlign: "center" }}>Lexical Rich Text Editor</h1>

      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-container">
          <ToolbarPlugin
            handleUploadFile={handleUploadFile}
            selectEmoji={selectEmoji}
            handleMention={handleMention}
          />
          <div className="editor-inner">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="editor-input"
                  aria-placeholder={placeholder}
                  placeholder={
                    <div className="editor-placeholder">{placeholder}</div>
                  }
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <MentionsPlugin />
            <OnChangePlugin
              onChange={(editorState, editor) => {
                editorRef.current = editor;
                const htmlOutput = exportHTML(editorState);
                setValue(htmlOutput);
              }}
            />
          </div>
        </div>
      </LexicalComposer>

      {openMenu === "emoji" && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 100,
            zIndex: 5,
          }}
          className="emoji-wrapper"
        >
          <Picker
            data={emojisData}
            locale={mapEmojiLocale["pt-BR"]}
            onEmojiSelect={handleSelectEmoji}
            onClickOutside={() => setOpenMenu("")}
          />
        </div>
      )}
    </div>
  );
};

export default LexicalRichText;
