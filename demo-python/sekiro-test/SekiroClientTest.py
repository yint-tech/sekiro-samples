import json
import time

from sekiro.SekiroClient import SekiroClient, SekiroHandler, SekiroResponse


class TestHandler(SekiroHandler):
    def handle(self, request: json, response: SekiroResponse):
        response.success("ok-python")


# client 测试
if __name__ == '__main__':
    # https://sekiro.iinti.cn/business/invoke?group=test-python&action=testAction&sekiro_token=123
    sekiro_client = SekiroClient("test-python")
    sekiro_client.register_action("testAction", TestHandler())
    sekiro_client.start()

    # 由于sekiro client运行在单独线程中，所以需要休眠一下，否则无法测试
    time.sleep(300)
