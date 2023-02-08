package cn.iinti.sekiro3;

import cn.iinti.sekiro3.business.api.ClusterSekiroClient;
import cn.iinti.sekiro3.business.api.core.eventbus.event.client.SekiroClientConnectEvent;
import cn.iinti.sekiro3.business.api.core.eventbus.event.client.SekiroClientDestroyEvent;
import cn.iinti.sekiro3.business.api.core.eventbus.event.client.SekiroClientDisConnectedEvent;
import cn.iinti.sekiro3.business.api.core.eventbus.event.cluster.ClusterClientDestroyEvent;
import cn.iinti.sekiro3.business.api.interfaze.ActionHandler;
import cn.iinti.sekiro3.business.api.interfaze.SekiroRequest;
import cn.iinti.sekiro3.business.api.interfaze.SekiroResponse;

public class Demo4_Lifecycle {
    public static void main(String[] args) throws InterruptedException {
        // http://sekiro.iinti.cn/business/invoke?group=test&action=test&sekiro_token=123
        ClusterSekiroClient sekiroClient = new ClusterSekiroClient("test", new String[]{"sekiro.iinti.com:5612"})
                .setupSekiroRequestInitializer((sekiroRequest, handlerRegistry) -> handlerRegistry.registerSekiroHandler(new ActionHandler() {

                    @Override
                    public String action() {
                        return "test";
                    }

                    @Override
                    public void handleRequest(SekiroRequest sekiroRequest, SekiroResponse sekiroResponse) {
                        sekiroResponse.success("ok");
                    }
                }))
                // 集群版和单机版均有这一组关于sekiro生命周期的挂钩点，给业务使用
                .addSekiroClientEventListener((SekiroClientConnectEvent) sekiroClient1 -> System.out.println(sekiroClient1.getClientKey() + ": 连接"))
                .addSekiroClientEventListener((SekiroClientDisConnectedEvent) sekiroClient12 -> System.out.println(sekiroClient12.getClientKey() + ": 断开"))
                .addSekiroClientEventListener((SekiroClientDestroyEvent) sekiroClient13 -> System.out.println(sekiroClient13.getClientKey() + ": 销毁"))
                .addClusterClientEventListener((ClusterClientDestroyEvent) clusterSekiroClient -> System.out.println("集群client销毁"))
                .start();

        Thread.sleep(20000);

        sekiroClient.destroy(10);
    }
}
