// src/App.jsx
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

// 匯入我們的 Python → Blockly 新檔案
import PythonToBlocks from './PythonToBlocks.jsx'

export default function App() {
  // ----------------------------
  // 此區塊：你的原本功能
  // ----------------------------
  const blocklyRef = useRef(null)     
  const workspaceRef = useRef(null)

  const aceRef = useRef(null)
  const aceEditorInstance = useRef(null)

  const [pythonCode, setPythonCode] = useState('print("Hello Ace!")\n')

  // 1) 初始化 Blockly
  useEffect(() => {
    if (workspaceRef.current) return
    if (!blocklyRef.current) return

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

    // 當積木變化時 → 生成 Python → 更新 pythonCode
    const handleChange = () => {
      const code = pythonGenerator.workspaceToCode(workspace)
      setPythonCode(code)
    }
    workspace.addChangeListener(handleChange)
  }, [])

  // 2) 初始化 Ace
  useEffect(() => {
    if (aceEditorInstance.current) return
    if (!aceRef.current) return

    const ace = window.ace.edit(aceRef.current, {
      mode: 'ace/mode/python',
      theme: 'ace/theme/chrome', 
      fontSize: 14,
      showPrintMargin: false
    })
    ace.setValue(pythonCode, -1)

    // 當使用者在 Ace 編輯 → 更新 pythonCode
    ace.on('change', () => {
      const currentCode = ace.getValue()
      setPythonCode(currentCode)
    })

    aceEditorInstance.current = ace
  }, [])

  // 3) pythonCode → Ace
  useEffect(() => {
    if (!aceEditorInstance.current) return

    const ace = aceEditorInstance.current
    const currentValue = ace.getValue()

    if (currentValue !== pythonCode) {
      ace.setValue(pythonCode, -1)
      // 強制刷新
      ace.clearSelection()
      ace.resize(true)
      ace.renderer.updateFull()
      ace.gotoLine(1, 0, true)
    }
  }, [pythonCode])

  // 4) 執行 Python
  const handleRunPython = async () => {
    if (!window.Sk) {
      console.error('Skulpt not loaded!')
      return
    }
    window.Sk.configure({
      output: (text) => {
        console.log('Skulpt output:', text)
      },
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

  // ----------------------------
  // 最終畫面 (JSX)
  // ----------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 上半部：原本的「Blockly + Ace + Skulpt」 */}
      <h2 style={{ margin: '10px' }}>Blockly → Python → Ace → Skulpt</h2>
      <div style={{ flex: 1, border: '2px solid #ccc', margin: '10px', display: 'flex' }}>
        {/* 左半邊：Blockly */}
        <div
          ref={blocklyRef}
          style={{
            width: '50%',
            height: '100%',
            border: '1px solid #ccc'
          }}
        />
        {/* 右半邊：Ace + 按鈕 */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
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

      <hr />

      {/* 下半部：PythonToBlocks (反向工程) */}
      <h2 style={{ margin: '10px' }}>Python → Blockly (Skulpt AST)</h2>
      <div style={{ flex: 1, border: '2px solid #ccc', margin: '10px' }}>
        <PythonToBlocks />
      </div>
    </div>
  )
}
