package sekio

import (
	"testing"
	"time"
)

type TestSekiroHandler struct {
}

func (TestSekiroHandler) handleRequest(request map[string]interface{}, response SekiroResponse) {
	response.Success("ok")
}

func TestSekiro(t *testing.T) {
	// https://sekiro.iinti.cn/business/invoke?group=test-go&action=testAction&sekiro_token=123
	client := MakeClientDefault("test-go")
	var handler RequestHandler = &TestSekiroHandler{}
	client.RegisterHandler("testAction", &handler).Start()

	time.Sleep(2 * time.Minute)
}
