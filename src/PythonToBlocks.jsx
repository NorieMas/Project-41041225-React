// src/PythonToBlocks.jsx
import React, { useEffect, useRef, useState } from 'react'
import * as Blockly from 'blockly'
import 'blockly/msg/en'
// Skulpt
import 'skulpt'
import 'skulpt/dist/skulpt.js'
import 'skulpt/dist/skulpt.min.js'
import 'skulpt/dist/skulpt-stdlib.js'

// 1) 定義自訂的積木
function defineCustomBlocks() {
  // print_block
  Blockly.Blocks['print_block'] = {
    init: function() {
      this.appendValueInput('TEXT')
          .setCheck(null)
          .appendField('print')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(160)
      this.setTooltip('Print something')
      this.setHelpUrl('')
    }
  }

  // assign_block
  Blockly.Blocks['assign_block'] = {
    init: function() {
      this.appendValueInput('VALUE')
          .setCheck(null)
          .appendField(new Blockly.FieldTextInput('x'), 'VAR')
          .appendField('=')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(230)
      this.setTooltip('Assign a value to a variable')
      this.setHelpUrl('')
    }
  }

  // if_block
  Blockly.Blocks['if_block'] = {
    init: function() {
      this.appendValueInput('COND')
          .setCheck(null)
          .appendField('if')
      this.appendStatementInput('DO')
          .setCheck(null)
          .appendField(':')
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(210)
      this.setTooltip('If statement')
      this.setHelpUrl('')
    }
  }

  // for_block
  Blockly.Blocks['for_block'] = {
    init: function() {
      this.appendDummyInput()
          .appendField('for')
          .appendField(new Blockly.FieldTextInput('i'), 'VAR')
          .appendField('in range(')
          .appendField(new Blockly.FieldNumber(5, 0), 'RANGE')
          .appendField('):')
      this.appendStatementInput('DO')
          .setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(120)
      this.setTooltip('For loop in range(N)')
      this.setHelpUrl('')
    }
  }
}

// 2) AST → Blockly
function parsePythonToBlocks(code, workspace) {
  console.log('[parsePythonToBlocks] code =', code)

  if (!code.trim()) {
    console.log('[parsePythonToBlocks] code is empty, clear workspace.')
    workspace.clear()
    return
  }

  let ast
  try {
    // 只保留最常見/穩定的 __future__ 屬性
    window.Sk.configure({
      __future__: {
        python3: true,
        python_version: true,
        print_function: true,
        division: true,
        unicode_literals: true,
        class_repr: true,
        inherit_from_object: true,
        super_args: true,
        octal_number_literal: true,
        bankers_rounding: true,
        dunder_round: true,
        exceptions: true,
        no_long_type: true,
        ceil_floor_int: true,
        silent_octal_literal: true,
        absolute_import: true
      }
    })

    ast = window.Sk.parse('temp.py', code)
    console.log('[parsePythonToBlocks] AST =', ast)
  } catch (e) {
    console.error('Parse Error:', e.toString())
    return
  }

  const xmlDoc = Blockly.utils.xml.createElement('xml')

  function visit(node, parentXML) {
    if (!node) return

    switch (node._astname) {
      case 'Module': {
        node.body.forEach(stmt => visit(stmt, parentXML))
        break
      }
      case 'Expr': {
        // 例如 print("Hello")
        if (node.value && node.value._astname === 'Call') {
          const callNode = node.value
          if (callNode.func && callNode.func._astname === 'Name') {
            // 確認函式名稱是 print
            if (callNode.func.id.v === 'print') {
              const block = Blockly.utils.xml.createElement('block')
              block.setAttribute('type', 'print_block')
              if (callNode.args && callNode.args[0]) {
                const argXML = exprToXML(callNode.args[0])
                if (argXML) {
                  const valNode = Blockly.utils.xml.createElement('value')
                  valNode.setAttribute('name', 'TEXT')
                  valNode.appendChild(argXML)
                  block.appendChild(valNode)
                }
              }
              parentXML.appendChild(block)
            }
          }
        }
        break
      }
      case 'Assign': {
        // x = 10
        const block = Blockly.utils.xml.createElement('block')
        block.setAttribute('type', 'assign_block')

        const target = node.targets[0]
        if (target && target._astname === 'Name') {
          const field = Blockly.utils.xml.createElement('field')
          field.setAttribute('name', 'VAR')
          field.textContent = target.id.v
          block.appendChild(field)
        }
        if (node.value) {
          const valXML = exprToXML(node.value)
          if (valXML) {
            const valNode = Blockly.utils.xml.createElement('value')
            valNode.setAttribute('name', 'VALUE')
            valNode.appendChild(valXML)
            block.appendChild(valNode)
          }
        }
        parentXML.appendChild(block)
        break
      }
      case 'If': {
        const block = Blockly.utils.xml.createElement('block')
        block.setAttribute('type', 'if_block')
        if (node.test) {
          const condXML = exprToXML(node.test)
          if (condXML) {
            const valueNode = Blockly.utils.xml.createElement('value')
            valueNode.setAttribute('name', 'COND')
            valueNode.appendChild(condXML)
            block.appendChild(valueNode)
          }
        }
        if (node.body && node.body.length) {
          const statementNode = Blockly.utils.xml.createElement('statement')
          statementNode.setAttribute('name', 'DO')
          node.body.forEach(stmt => visit(stmt, statementNode))
          block.appendChild(statementNode)
        }
        parentXML.appendChild(block)
        break
      }
      case 'For': {
        const block = Blockly.utils.xml.createElement('block')
        block.setAttribute('type', 'for_block')
        if (node.target && node.target._astname === 'Name') {
          const field = Blockly.utils.xml.createElement('field')
          field.setAttribute('name', 'VAR')
          field.textContent = node.target.id.v
          block.appendChild(field)
        }
        if (node.iter && node.iter._astname === 'Call' && node.iter.func._astname === 'Name') {
          if (node.iter.func.id.v === 'range' && node.iter.args[0]) {
            const arg = node.iter.args[0]
            if (arg._astname === 'Constant') {
              const rangeField = Blockly.utils.xml.createElement('field')
              rangeField.setAttribute('name', 'RANGE')
              rangeField.textContent = arg.value.v
              block.appendChild(rangeField)
            }
          }
        }
        if (node.body && node.body.length) {
          const statementNode = Blockly.utils.xml.createElement('statement')
          statementNode.setAttribute('name', 'DO')
          node.body.forEach(stmt => visit(stmt, statementNode))
          block.appendChild(statementNode)
        }
        parentXML.appendChild(block)
        break
      }
      default:
        // 其他語法先不處理
        break
    }
  }

  function exprToXML(exprNode) {
    if (!exprNode) return null

    if (exprNode._astname === 'Constant') {
      const val = exprNode.value.v
      if (typeof val === 'number') {
        // 數字
        const block = Blockly.utils.xml.createElement('block')
        block.setAttribute('type', 'math_number')
        const field = Blockly.utils.xml.createElement('field')
        field.setAttribute('name', 'NUM')
        field.textContent = val
        block.appendChild(field)
        return block
      } else {
        // 字串
        const block = Blockly.utils.xml.createElement('block')
        block.setAttribute('type', 'text')
        const field = Blockly.utils.xml.createElement('field')
        field.setAttribute('name', 'TEXT')
        field.textContent = val
        block.appendChild(field)
        return block
      }
    }
    else if (exprNode._astname === 'Name') {
      // 例如 x
      const block = Blockly.utils.xml.createElement('block')
      block.setAttribute('type', 'text')
      const field = Blockly.utils.xml.createElement('field')
      field.setAttribute('name', 'TEXT')
      field.textContent = exprNode.id.v
      block.appendChild(field)
      return block
    }
    return null
  }

  // 遞迴拜訪 AST
  visit(ast, xmlDoc)

  // 清空原積木，再載入新的
  workspace.clear()
  Blockly.Xml.domToWorkspace(xmlDoc, workspace)
}

export default function PythonToBlocks() {
  const [pythonCode, setPythonCode] = useState(`
x = 10
print(x)
if x:
    print("hello")
for i in range(3):
    print(i)
`)

  const blocklyRef = useRef(null)
  const workspaceRef = useRef(null)

  // 第一次載入時，定義積木
  useEffect(() => {
    defineCustomBlocks()
  }, [])

  // 初始化 Blockly
  useEffect(() => {
    if (workspaceRef.current) return
    if (!blocklyRef.current) return

    const workspace = Blockly.inject(blocklyRef.current, {
      toolbox: `
        <xml>
          <block type="math_number"></block>
          <block type="text"></block>
          <block type="print_block"></block>
          <block type="assign_block"></block>
          <block type="if_block"></block>
          <block type="for_block"></block>
        </xml>
      `,
      trashcan: true
    })
    workspaceRef.current = workspace
  }, [])

  // 按鈕：Parse
  const handleParse = () => {
    if (workspaceRef.current) {
      parsePythonToBlocks(pythonCode, workspaceRef.current)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 左：輸入框 */}
      <div style={{ width: '40%', padding: '10px', display: 'flex', flexDirection: 'column' }}>
        <h3>Python Code</h3>
        <textarea
          style={{ flex: 1 }}
          value={pythonCode}
          onChange={(e) => setPythonCode(e.target.value)}
        />
        <button onClick={handleParse} style={{ marginTop: '10px' }}>
          Parse to Blockly
        </button>
      </div>

      {/* 右：積木介面 */}
      <div
        ref={blocklyRef}
        style={{ width: '60%', height: '100%', border: '1px solid #ccc' }}
      />
    </div>
  )
}
