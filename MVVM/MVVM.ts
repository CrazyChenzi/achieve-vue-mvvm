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
