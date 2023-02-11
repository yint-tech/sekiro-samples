import json

from SekiroClient import SekiroClient, SekiroHandler, SekiroResponse


class TestHandler(SekiroHandler):
    def handle(self, request: json, response: SekiroResponse):
        response.success("ok-python")


if __name__ == '__main__':
    # https://sekiro.iinti.cn/business/invoke?group=test-python&action=testAction&sekiro_token=123
    sekiro_client = SekiroClient("test-python")
    sekiro_client.register_action("testAction", TestHandler())
    sekiro_client.run_sync()
