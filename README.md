# achieve-vue-mvvm
实现一个vue mvvm

[Vue 深入响应式原理](https://cn.vuejs.org/v2/guide/reactivity.html)

![如何追踪变化](https://cn.vuejs.org/images/data.png)

1. 订阅中心`dep`，提供添加、移除、通知订阅的`Function`
2. 数据监听器`observer`，通过[defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)监听对象所有属性，并在发生变化的时候通知订阅者
3. 指令解析器`compiler`，解析模板初始化视图，收集模板中的数据依赖，创建订阅者订阅数据变化，绑定更新函数
4. `watcher`链接`observer` `compiler`，能够订阅并收到每个属性的变动通知，执行指令绑定到相应的回调函数，从而更新视图
5. 结合以上，完成建议的`MVVM`

![mvvm](https://github.com/DMQ/mvvm/blob/master/img/2.png?raw=true)

## Dep.ts

`Dep`作为发布订阅的中心，每一个`data`的属性都绑定一个`Dep`实例，`Dep`提供添加、移除、通知`Function`

```typescript
let uid = 0 // 生成唯一uid时使用

class Dep {
  private id = uid++  // 用来识别Dep实例
  private subs = [] // 用来存储已经生产的Dep实例
  static target: any
  constructor() {
  }

  public addSub(sub) {
    this.subs.push(sub)
  }
  public removeSub(sub) {
    const index = this.subs.findIndex((key) => key === sub)
    if (index !== -1) this.subs.splice(index, 1)
  }
  public depend() {
    // 控制依赖反转，Dep.target 为 Watcher 实例
    // 把某属性对应的 Dep 实例传递给 Watcher 实例进行操作
    Dep.target.applyDep(this)
  }
  public notify() {
    this.subs.forEach((sub) => {
      sub.update()
    })
  }
}

// 当需要获取订阅属性的值时，绑定watcher实例，其它时间为null
Dep.target = null

export default Dep
```

## Watcher.ts

```typescript
import Dep from './Dep'

// 返回获取嵌套属性值 eg：a.b.c 的函数
const parseGetter = (exp: any) => {
  // 过滤不合法的属性表达式
  if (/[^\w.$]/.test(exp)) return

  const exps = exp.split('.')
  return (obj: any) => {
    let value = obj
    if (obj) {
      exps.forEach((key: string) => value = value[key])
    }
    return value
  }
}

class Watcher {
  private value: any
  private depIds = {} // 存储Dep
  private getter: Function
  private vm: any // mvvm实例
  private cb: Function
  private expOrFn: any
  constructor(vm: any, expOrFn: any, cb: Function) {
    this.vm = vm
    this.cb = cb
    this.expOrFn = expOrFn

    // expOrFn 可能是 xxx、xxx.xxx、fn()
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parseGetter(expOrFn.trim())
    }

    this.value = this._getValue()
  }
  // 获取Watcher实例监听的值
  private _getValue() {
    // 访问监听的属性时把 Dep.target 指向自身，从而在 Observer 中把当前实例添加到属性订阅者中
    Dep.target = this
    const value = this.getter(this.vm)
    // 获取属性值后置空 Dep.target
    Dep.target = null
    return value
  }
  // 更新视图
  private update() {
    const value = this._getValue()
    const oldVal = this.value
    // 如果值有变化调用 callback 更新值
    if (value !== oldVal) {
      this.value = value
      this.cb.call(this.vm, value, oldVal)
    }
  }
  /* 
    1. 每次调用 update()的时候会触发相应属性的getter，getter里面会触发dep.depend()，继而触发这里的addDep
    2. 假如相应属性的dep.id已经在当前watcher的depIds里，说明不是一个新的属性，仅仅是改变了其值而已
    则不需要将当前watcher添加到该属性的dep里
    3. 假如相应属性是新的属性，则将当前watcher添加到新属性的dep里
    如通过 vm.child = {name: 'a'} 改变了 child.name 的值，child.name 就是个新属性
    则需要将当前watcher(child.name)加入到新的 child.name 的dep里
    因为此时 child.name 是个新值，之前的 setter、dep 都已经失效，如果不把 watcher 加入到新的 child.name 的dep中
    通过 child.name = xxx 赋值的时候，对应的 watcher 就收不到通知，等于失效了
    4. 每个子属性的watcher在添加到子属性的dep的同时，也会添加到父属性的dep
    监听子属性的同时监听父属性的变更，这样，父属性改变时，子属性的watcher也能收到通知进行update
    这一步是在 this.get() --> this.getVMVal() 里面完成，forEach时会从父级开始取值，间接调用了它的getter
    触发了addDep(), 在整个forEach过程，当前wacher都会加入到每个父级过程属性的dep
    例如：当前watcher的是'child.child.name', 那么child, child.child, child.child.name这三个属性的dep都会加入当前watcher 
    */
   private applyDep(dep: any) {
    if (!this.depIds.hasOwnProperty(dep.id)) {
      dep.addSub(this)
      this.depIds[dep.id] = dep
    }
  }
}

export default Watcher
```

## Observer.ts

```typescript
import Dep from './Dep'

class Observer {
  private data: any // 需要代理的data项
  constructor(data: any) {
    this.data = data
    this.defineReactive(data)
  }
  private defineReactive(data: any) {
    Object.keys(data).forEach((key) => {
      let descriptor = data[key]
      // 每一个key都绑定一个Dep实例
      const dep = new Dep()
      // 监听child
      observe(descriptor)
      Object.defineProperty(data, key, {
        configurable: false,
        enumerable: true,
        get() {
          // 访问该 key 时如果 Dep.target 指向 Watcher 实例，把该 key 对应的 Dep 实例传递给 Watcher 实例
          // 也可以直接 dep.addSub(Dep.target)
          Dep.target && dep.depend()
          return descriptor
        },
        set(newVal) {
          if (newVal === descriptor) return
          descriptor = newVal
          // 监听新值
          observe(descriptor)
          // 通知订阅该key的Watcher实例
          dep.notify()
        }
      })
    })
  }
}

export const observe = (data: any) => {
  if (!data || typeof data !== 'object') return
  new Observer(data)
}
```

## Compiler.ts

[MDN-Node.nodeType](https://developer.mozilla.org/zh-CN/docs/Web/API/Node/nodeType)

[MDN-Document.createDocumentFragment()](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/createDocumentFragment)

```typescript
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
```

## MVVM.ts

```typescript
import Watcher from './Watcher'
import Compiler from './Compiler'
import { observe } from './Observer'

class MVVM {
  private $options: any
  private $data: {}
  private $el: string
  private $compile: any
  constructor(options: any) {
    this.$options = options
    this.$data = options.data || {}
    this.$el = options.el
    this._init()
    this.$compile = new Compiler(options.el || document.body, this)
  }

  private _init() {
    this._proxyData()
    this._proxyComputed()
    this._bindMethods()
    observe(this.$data)
  }

  // data 代理，实现 vm.xxx, this.xxx -> vm.$data.xxx
  private _proxyData() {
    const { $data } = this
    for (const key in $data) {
      Object.defineProperty(this, key, {
        configurable: false,
        enumerable: true,
        get() {
          return $data[key]
        },
        set(newVal) {
          $data[key] = newVal
        },
      })
    }
  }

  // computed 属性代理，实现 vm.xxx, this.xxx -> this.$options.computed.xxx
  private _proxyComputed() {
    const computed = this.$options.computed
    if (typeof computed === 'object') {
      for (const key in computed) {
        Object.defineProperty(this, key, {
          get:
            typeof computed[key] === 'function'
              ? computed[key]
              : computed[key].get,
          set: function() {},
        })
      }
    }
  }

  // 绑定 options.methods 的方法到 this 上
  private _bindMethods() {
    const methods = this.$options.methods
    if (typeof methods === 'object') {
      for (const key in methods) {
        Object.defineProperty(
          this,
          key,
          Object.getOwnPropertyDescriptor(methods, key),
        )
      }
    }
  }

  private $watch(key: string, cb: Function) {
    new Watcher(this, key, cb)
  }
}

export default MVVM
```

## 参考

[DMQ/mvvm](https://github.com/DMQ/mvvm)

[Vue MVVM 实现（defineProperty 篇）](https://jancat.github.io/post/2019/vue-mvvm/)

