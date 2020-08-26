import Dep from './Dep'

class Observer {
  private data: any
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
