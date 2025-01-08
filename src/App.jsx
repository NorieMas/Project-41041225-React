import React, { useEffect, useRef, useState } from 'react'

// Blockly
import * as Blockly from 'blockly'
import 'blockly/msg/en'
import 'blockly/python' // 讓 Blockly 能產生 Python 程式碼
import { pythonGenerator } from 'blockly/python'

// Ace (直接從 ace-builds 來做原生用法)
import 'ace-builds/src-min-noconflict/ace'
import 'ace-builds/src-min-noconflict/mode-python'
import 'ace-builds/src-min-noconflict/theme-monokai'

// Skulpt (安裝後可直接 import，但它主要掛在 window.Sk)
import 'skulpt' // or `import Sk from 'skulpt'` 但官方封裝常用全域 window.Sk

export default function App() {
  // Blockly 容器
  const blocklyRef = useRef(null)

  // Ace Editor 容器
  const aceRef = useRef(null)
  const aceEditorInstance = useRef(null)

  // Python 程式碼狀態
  const [pythonCode, setPythonCode] = useState('print("Hello from Ace!")\n')

  const workspaceRef = useRef(null) // 用來存儲 workspace 實例

  // 初始化 Blockly
  useEffect(() => {
    // 如果已經有 workspace，就不要再建一次
    if (workspaceRef.current) {
      return
    }

    if (blocklyRef.current) {
      const workspace = Blockly.inject(blocklyRef.current, {
        toolbox: `<xml>
                    <block type="text_print"></block>
                    <block type="text"></block>
                    <block type="math_number"></block>
                  </xml>`,
        trashcan: true
      })

      workspaceRef.current = workspace

      // 監聽積木變動
      const handleChange = () => {
        const code = pythonGenerator.workspaceToCode(workspace)
        setPythonCode(code)
      }
      workspace.addChangeListener(handleChange)
    }
  }, [])

  return (
    <div style={{ display: 'flex' }}>
      <div ref={blocklyRef} style={{ width: '50%', height: '100vh' }} />
      <textarea
        style={{ width: '50%', height: '100vh' }}
        value={pythonCode}
        onChange={() => {}}
      />
    </div>
  )

  // 初始化 Ace Editor
  useEffect(() => {
    if (!aceRef.current) return

    // 建立 Ace 編輯器
    const ace = window.ace.edit(aceRef.current, {
      mode: 'ace/mode/python',
      theme: 'ace/theme/monokai',
      fontSize: 14,
      showPrintMargin: false
    })

    // 初始內容
    ace.setValue(pythonCode, -1)

    // 若想要監聽編輯器修改 -> 更新 pythonCode，
    // 需在這裡對 Ace 的 onChange 事件做 setPythonCode(...)
    ace.on('change', () => {
      // 這裡如果想做「Ace -> Blockly」的雙向同步就很複雜，示範只單向就好
      const currentCode = ace.getValue()
      setPythonCode(currentCode)
    })

    // 存下 Ace 實例
    aceEditorInstance.current = ace

    // Unmount 時銷毀
    return () => {
      ace.destroy()
    }
  }, [])

  // 如果外部(Blockly)的 pythonCode 有更新，也同步到 Ace 編輯器
  useEffect(() => {
    if (aceEditorInstance.current) {
      // 設定 Ace 的內容
      const currentValue = aceEditorInstance.current.getValue()
      if (currentValue !== pythonCode) {
        aceEditorInstance.current.setValue(pythonCode, -1)
      }
    }
  }, [pythonCode])

  // 執行 Python
  const handleRunPython = async () => {
    // 確認 Skulpt 是否存在
    if (!window.Sk) {
      alert('Skulpt not loaded!')
      return
    }

    // 配置輸出
    const outf = (text) => {
      // 這裡可以做更好的輸出處理，例如串到 UI
      console.log('Skulpt output:', text)
    }

    window.Sk.configure({
      output: outf,
      read: (file) => {
        if (window.Sk.builtinFiles === undefined ||
            window.Sk.builtinFiles['files'][file] === undefined) {
          throw new Error(`File not found: '${file}'`)
        }
        return window.Sk.builtinFiles['files'][file]
      }
    })

    try {
      // 非同步方式執行
      await window.Sk.misceval.asyncToPromise(() =>
        window.Sk.importMainWithBody('<stdin>', false, pythonCode, true)
      )
      console.log('Execution finished.')
    } catch (err) {
      console.error('Skulpt error:', err.toString())
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 左半邊: Blockly */}
      <div
        ref={blocklyRef}
        style={{ width: '50%', height: '100%', border: '1px solid #ccc' }}
      />

      {/* 右半邊: Ace Editor + 按鈕 */}
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        <div
          ref={aceRef}
          style={{ flex: 1, border: '1px solid #ccc' }}
        />
        <button onClick={handleRunPython} style={{ height: '60px' }}>
          Run Python (Skulpt)
        </button>
      </div>
    </div>
  )
}
