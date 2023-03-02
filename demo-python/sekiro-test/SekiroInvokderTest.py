import json

from sekiro.SekiroInvoker import SekiroInvoker

# client 测试
if __name__ == '__main__':
    # https://sekiro.iinti.cn/business/invoke?group=test-python&action=testAction&sekiro_token=123
    sekiro_invoker = SekiroInvoker()
    print("begin request..")
    response = sekiro_invoker.request("test-python", "testAction", param="testparm")
    print("invoke response: " + str(json.dumps(response, ensure_ascii=False)))
