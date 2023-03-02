# SekiroFrida

这是Frida中Sekiro的sdk的使用方法，使用Frida标准API实现，支持所有Frida环境（如PC、Android、IOS等平台），测试请注入``test.ts``
到目标进程中，即可完成demo

# 测试(android为例)

- frida命令： ``frida -U -l test.ts -f cn.iinti.majora.adr`` (其中cn.iinti.majora.adr是一个app的包名)
- 测试url：http://sekiro.iinti.cn:5612/business/invoke?group=test_frida&action=testAction&param=testparm