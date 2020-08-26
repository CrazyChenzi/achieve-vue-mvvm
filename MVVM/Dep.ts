let uid = 0

class Dep {
  private id = uid++  // 用来识别Dep实例
  private subs = []
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

Dep.target = null

export default Dep
