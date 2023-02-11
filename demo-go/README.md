# Sekiro的go语言环境

```go
package main

import "iinti.cn/sekiro"

type TestSekiroHandler struct {
}

// handler处理器
func (TestSekiroHandler) handleRequest(request map[string]interface{}, response SekiroResponse) {
	response.Success("ok")
}

func TestSekiro(t *testing.T) {
	// https://sekiro.iinti.cn/business/invoke?group=test-go&action=testAction&sekiro_token=123
	client := MakeClientDefault("test-go")
	var handler RequestHandler = &TestSekiroHandler{}
	client.RegisterHandler("testAction", &handler).Start()

	// 请注意，由于内部是go routine，所以这里正常会直接运行结束，所以休眠一下
	time.Sleep(2 * time.Minute)
}
```