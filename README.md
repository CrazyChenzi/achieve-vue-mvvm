# achieve-vue-mvvm
实现一个vue mvvm

[Vue 深入响应式原理](https://cn.vuejs.org/v2/guide/reactivity.html)

1. 数据监听器`observer`，通过[defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)监听对象所有属性，并在发生变化的时候通知订阅者

2. 指令解析器`compiler`，解析模板初始化视图，收集模板中的数据依赖，创建订阅者订阅数据变化，绑定更新函数

3. `watcher`链接`observer` `compiler`，能够订阅并收到每个属性的变动通知，执行指令绑定到相应的回调函数，从而更新视图

4. 结合以上三者，完成建议的`MVVM`

![mvvm](https://github.com/DMQ/mvvm/blob/master/img/2.png?raw=true)
