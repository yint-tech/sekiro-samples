package cn.iinti.sekiro3;

import cn.iinti.sekiro3.business.api.ClusterSekiroClient;
import cn.iinti.sekiro3.business.api.interfaze.ActionHandler;
import cn.iinti.sekiro3.business.api.interfaze.SekiroRequest;
import cn.iinti.sekiro3.business.api.interfaze.SekiroResponse;

public class Demo2_ClusterServer {
    public static void main(String[] args) throws InterruptedException {
        //   http://sekiro.iinti.cn/business/invoke?group=test_group_02&action=testAction&param=testparm
        String[] serverList = new String[]{"sekiro.iinti.cn:5621", "sekiro.virjar.com:5612"};
        // 集群版本直接传入多个服务器列表，即可使用多台sekiro服务器做高可用备份
        // 请注意集群版本下consumer存在配置，使用nginx或者invoker，更多信息请参考文档关于sekiro集群ha相关内容

        new ClusterSekiroClient("test", serverList)
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
