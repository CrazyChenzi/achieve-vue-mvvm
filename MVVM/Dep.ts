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
