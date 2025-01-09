import React, { useEffect, useRef, useState } from 'react'

// Blockly
import * as Blockly from 'blockly'
import 'blockly/msg/en'
import { pythonGenerator } from 'blockly/python'

// Ace (直接從 ace-builds 來做原生用法)
import 'ace-builds/src-noconflict/ace'
import 'ace-builds/src-noconflict/mode-python'
// 淺色主題（也可改回 monokai）
import 'ace-builds/src-noconflict/theme-chrome'

// Skulpt
import 'skulpt'

export default function App() {
  const blocklyRef = useRef(null)     // Blockly 容器
  const workspaceRef = useRef(null)   // 避免重複初始化 workspace

  const aceRef = useRef(null)         // Ace 容器
  const aceEditorInstance = useRef(null)

  const [pythonCode, setPythonCode] = useState('print("Hello Ace!")\n')

  // --------------------
  // 1) 初始化 Blockly
  // --------------------
  useEffect(() => {
    if (workspaceRef.current) return // 已初始化就略過
    if (!blocklyRef.current) return  // DOM 尚未掛載

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: `
        <xml xmlns="https://developers.google.com/blockly/xml">
          <block type="text_print"></block>
          <block type="text"></block>
          <block type="math_number"></block>
        </xml>
      `,
      trashcan: true
    })
    workspaceRef.current = workspace

    // 當積木變化時，產生 Python → setPythonCode
    const handleChange = () => {
      const code = pythonGenerator.workspaceToCode(workspace)
      setPythonCode(code)
    }
    workspace.addChangeListener(handleChange)
  }, [])

  // --------------------
  // 2) 初始化 Ace Editor
  // --------------------
  useEffect(() => {
    if (aceEditorInstance.current) return // 已初始化就略過
    if (!aceRef.current) return           // DOM 尚未掛載

    const ace = window.ace.edit(aceRef.current, {
      mode: 'ace/mode/python',
      theme: 'ace/theme/chrome',  // 如果想回深色，就改 'ace/theme/monokai'
      fontSize: 14,
      showPrintMargin: false
    })
    // 初始顯示
    ace.setValue(pythonCode, -1)

    // Ace 編輯器 → Python 程式碼 (單向同步)
    ace.on('change', () => {
      const currentCode = ace.getValue()
      setPythonCode(currentCode)
    })

    aceEditorInstance.current = ace
  }, [])

  // --------------------
  // 3) pythonCode → Ace
  // --------------------
  useEffect(() => {
    if (!aceEditorInstance.current) return

    const ace = aceEditorInstance.current
    const currentValue = ace.getValue()
    if (currentValue !== pythonCode) {
      ace.setValue(pythonCode, -1)
      // 強制刷新 + 回到最上方（避免顯示空白）
      ace.clearSelection()
      ace.resize(true)
      ace.renderer.updateFull()
      ace.gotoLine(1, 0, true)
    }
  }, [pythonCode])

  // --------------------
  // 4) 執行 Python (Skulpt)
  // --------------------
  const handleRunPython = async () => {
    if (!window.Sk) {
      console.error('Skulpt not loaded!')
      return
    }

    window.Sk.configure({
      output: (text) => console.log('Skulpt output:', text),
      read: (file) => {
        if (!window.Sk.builtinFiles?.files[file]) {
          throw new Error(`File not found: ${file}`)
        }
        return window.Sk.builtinFiles.files[file]
      }
    })

    try {
      await window.Sk.misceval.asyncToPromise(() =>
        window.Sk.importMainWithBody('<stdin>', false, pythonCode, true)
      )
      console.log('Execution finished.')
    } catch (err) {
      console.error('Skulpt error:', err)
    }
  }

  // --------------------
  // 5) JSX 佈局
  // --------------------
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 左半邊：Blockly */}
      <div
        ref={blocklyRef}
        style={{
          width: '50%',
          height: '100%',
          border: '1px solid #ccc'
        }}
      />

      {/* 右半邊：Ace Editor + 按鈕 */}
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          ref={aceRef}
          style={{
            flex: 1,
            border: '1px solid #ccc'
          }}
        />
        <button onClick={handleRunPython} style={{ height: '60px' }}>
          Run Python
        </button>
      </div>
    </div>
  )
}
