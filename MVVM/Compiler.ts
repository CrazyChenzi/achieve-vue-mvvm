import Watcher from './Watcher'

const isElementNode = (node: string | Element) => (node as Element).nodeType === 1  // 一个元素节点
const isTextNode = (node: Element) => node.nodeType === 3 // 	Element 或者 Attr 中实际的  文字
const isDirective = (attr: string) => attr.indexOf('v-') === 0  // 指令
const isEventDirective = (directive: string) => directive.indexOf('on') === 0 // 事件

function nodeToFragment(node: Element) {
  const fragment = document.createDocumentFragment()

  // 将原生节点移动到fragment
  let child = node.firstChild
  while (child) {
    fragment.appendChild(child)
    child = node.firstChild
  }

  return fragment
}

const updater = {
  textUpdater(node: Element, value: any) {
    node.textContent = typeof value === 'undefined' ? '' : value
  },

  htmlUpdater(node: Element, value: any) {
    node.innerHTML = typeof value === 'undefined' ? '' : value
  },

  classUpdater(node: Element, value: any, oldValue: any) {
    let className = node.className
    className = className.replace(oldValue, '').replace(/\s$/, '')

    const space = className && String(value) ? ' ' : ''

    node.className = className + space + value
  },

  modelUpdater(node: HTMLElement, value: any) {
    (node as HTMLInputElement).value = typeof value === 'undefined' ? '' : value
  },
}

// 指令处理集合
const compilerUtils = {
  text(node: Element, vm: any, exp: string) {
    this.bind(node, vm, exp, 'text')
  },

  html(node: Element, vm: any, exp: string) {
    this.bind(node, vm, exp, 'html')
  },

  model(node: Element, vm: any, exp: string) {
    this.bind(node, vm, exp, 'model')

    let val = this._getVMVal(vm, exp)
    node.addEventListener('input', e => {
      const newValue = (e.target as HTMLInputElement).value
      if (val === newValue) {
        return
      }
      this._setVMVal(vm, exp, newValue)
      val = newValue
    })
  },

  class(node: Element, vm: any, exp: string) {
    this.bind(node, vm, exp, 'class')
  },

  bind(node: Element, vm: any, exp: string, dir: string) {
    const updaterFn = updater[dir + 'Updater']

    updaterFn && updaterFn(node, this._getVMVal(vm, exp))

    new Watcher(vm, exp, (value: any, oldValue: any) => {
      updaterFn && updaterFn(node, value, oldValue)
    })
  },

  // 事件处理
  eventHandler(node: Element, vm: any, exp: any, dir: any) {
    const eventType = dir.split(':')[1]
    const fn = vm.$options.methods && vm.$options.methods[exp]

    if (eventType && fn) {
      node.addEventListener(eventType, fn.bind(vm), false)
    }
  },

  _getVMVal(vm: any, exp: string | string[]) {
    let val = vm
    exp = (exp as string).split('.')
    exp.forEach(key => (val = val[key]))
    return val
  },

  _setVMVal(vm: any, exp: string | string[], value: any) {
    let val = vm
    exp = (exp as string).split('.')
    exp.forEach((key, index) => {
      // 非最后一个key，更新val的值
      if (index < exp.length - 1) {
        val = val[key]
      } else {
        val[key] = value
      }
    })
  },
}

class Compiler {
  private $el: boolean | Element | null
  private $vm: any
  private $fragment: DocumentFragment
  constructor(el: string | Element, vm: any) {
    this.$el = (isElementNode(el) ? el : document.querySelector(el as string)) as boolean | Element | null
    this.$vm = vm

    if (this.$el && typeof this.$el !== 'boolean') {
      const el = this.$el as Element
      this.$fragment = nodeToFragment(el)
      this.compileElement(this.$fragment)
      el.appendChild(this.$fragment)
    }
  }

  private compileElement(el: DocumentFragment | ChildNode) {
    Array.from(el.childNodes).forEach((node: Element) => {
      const text = node.textContent
      const reg = /\{\{(.*)\}\}/

      if (isElementNode(node)) {
        this.compile(node)
      } else if (isTextNode(node) && reg.test(text)) {
        this.compileText(node, RegExp.$1.trim())
      }

      if (node.childNodes && node.childNodes.length) {
        this.compileElement(node)
      }
    })
  }

  private compile(node: Element) {
    Array.from(node.attributes).forEach(attr => {
      const attrName = attr.name
      if (isDirective(attrName)) {
        const exp = attr.value
        const dir = attrName.substring(2)
        // 事件指令
        if (isEventDirective(dir)) {
          compilerUtils.eventHandler(node, this.$vm, exp, dir)
          // 普通指令
        } else {
          compilerUtils[dir] && compilerUtils[dir](node, this.$vm, exp)
        }

        node.removeAttribute(attrName)
      }
    })
  }

  private compileText(node: Element, exp: string) {
    compilerUtils.text(node, this.$vm, exp)
  }
}

export default Compiler
