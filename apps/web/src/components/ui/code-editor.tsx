import {
  DiffEditor,
  type DiffEditorProps,
  default as Editor,
  type EditorProps,
  type Monaco,
} from '@monaco-editor/react'
import { useIsDark } from '@/stores/theme.store'

/** Lean editor chrome shared by every Monaco-based tool. */
export const editorOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
  lineNumbersMinChars: 3,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlightOnlyWhenFocus: true,
  scrollBeyondLastLine: false,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
  padding: { top: 6, bottom: 6 },
  fixedOverflowWidgets: true,
} as const

// Backgrounds match --card so editors sit flush inside panels
function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme('good-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editorLineNumber.foreground': '#b4b4b4',
      'editorLineNumber.activeForeground': '#404040',
      'editor.lineHighlightBackground': '#f5f5f5',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#ededed',
      'scrollbarSlider.background': '#00000018',
      'scrollbarSlider.hoverBackground': '#00000030',
      'scrollbarSlider.activeBackground': '#00000040',
      focusBorder: '#00000000',
    },
  })
  monaco.editor.defineTheme('good-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#121212',
      'editorGutter.background': '#121212',
      'editorLineNumber.foreground': '#5a5a5a',
      'editorLineNumber.activeForeground': '#c8c8c8',
      'editor.lineHighlightBackground': '#1c1c1c',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#262626',
      'scrollbarSlider.background': '#ffffff18',
      'scrollbarSlider.hoverBackground': '#ffffff30',
      'scrollbarSlider.activeBackground': '#ffffff40',
      focusBorder: '#00000000',
    },
  })
}

const useTheme = () => (useIsDark() ? 'good-dark' : 'good-light')

/** Monaco editor with the site's theme and defaults; fills its container. */
export function CodeEditor({ options, beforeMount, ...props }: EditorProps) {
  return (
    <Editor
      height='100%'
      theme={useTheme()}
      beforeMount={(m) => {
        defineThemes(m)
        beforeMount?.(m)
      }}
      {...props}
      options={{ ...editorOptions, ...options }}
    />
  )
}

/** Monaco diff editor with the site's theme and defaults. */
export function CodeDiffEditor({ options, beforeMount, ...props }: DiffEditorProps) {
  return (
    <DiffEditor
      height='100%'
      theme={useTheme()}
      beforeMount={(m) => {
        defineThemes(m)
        beforeMount?.(m)
      }}
      {...props}
      options={{ ...editorOptions, ...options }}
    />
  )
}
