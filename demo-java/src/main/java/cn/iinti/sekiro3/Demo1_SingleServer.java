package cn.iinti.sekiro3;

import cn.iinti.sekiro3.business.api.SekiroClient;
import cn.iinti.sekiro3.business.api.interfaze.*;

public class Demo1_SingleServer {
    public static void main(String[] args) throws InterruptedException {
        //http://sekiro.iinti.cn/business/invoke?group=test&action=testAction&param=testparm
        new SekiroClient("test", "testClient")
                .setupSekiroRequestInitializer((sekiroRequest, handlerRegistry) ->
                        // 注册一个接口，名为testAction
                        handlerRegistry.registerSekiroHandler(new ActionHandler() {
                            @Override
                            public String action() {
                                return "testAction";
                            }

                            @Override
                            public void handleRequest(SekiroRequest sekiroRequest, SekiroResponse sekiroResponse) {
                                // 接口处理逻辑，我们不做任何处理，直接返回字符串：ok
                                sekiroResponse.success("ok");
                            }
                        })).start();
        Thread.sleep(20000);
    }
}