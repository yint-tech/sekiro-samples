# Sekiro-Samples

这是Sekiro项目的官方demo，将会简单的演示在不同语言和环境中，如何使用Sekiro

目前已经支持如下环境：

- demo-java: 以maven作为构建的标准maven项目中，如何使用sekiro。请注意java是sekiro最官方的语言，几乎所有特性都是先行在java侧设计和测试，其他语言的特性可能有少许滞后
- demo-xposed：本质也是java语言，不过用于Android中，所有仓库配置方法为Android的gradle。他和java公用相同sdk，更多用法可以参考demo-java项目
- demo-frida：在Frida中使用sekiro，请注意本版本的Frida才是官方的、最彻底的Sekiro-Frida支持方案（由于Sekiro迟迟没有官方支持Frida，所以市面上存在多个开源版本的实现，不过目前开源版本实现均通过python、dex等方式进行中转，起普适性和稳定性存在一些缺陷）。
- demo-web：在浏览器中使用Sekiro，需要注意的是，在浏览器中由于wss的权限拦截问题，可能需要一些额外配置才能应对比较正规的网站。具体资料需要参考Sekiro的文档
- sekiro-python（很快到来）：使用python tornado实现的sdk，给python的标准环境使用
- sekiro-go（代码整理中，敬请期待）：go语言的sdk
- sekiro-ios： 将在最后支持
