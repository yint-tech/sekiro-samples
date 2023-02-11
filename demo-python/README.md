# sekiro-python
使用tornado实现python的sekiro client。

## 使用方法
```python
import json

from SekiroClient import SekiroClient, SekiroHandler, SekiroResponse


class TestHandler(SekiroHandler):
    def handle(self, request: json, response: SekiroResponse):
        response.success("ok")


if __name__ == '__main__':
    sekiro_client = SekiroClient("test-python")
    sekiro_client.register_action("testAction", TestHandler())
    sekiro_client.run_sync()

```

## 注意事项

* 一般情况下，python不常用多线程结构，故SekiroClient没有做多线程包装，在高并发的情况下，用户需要自身完成多线程包装。以及Sekiro的启动函数：``SekiroClient.run_sync``是同步阻塞
* 由于python json库无法序列化任意对象，故如果返回数据是一个json，那么需要保证这个对象是可以被json 序列化，或者需要自行将对象转换为字典