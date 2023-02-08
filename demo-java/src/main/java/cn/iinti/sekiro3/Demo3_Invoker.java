package cn.iinti.sekiro3;


import cn.iinti.sekiro3.business.api.SekiroInvoker;
import cn.iinti.sekiro3.business.api.invoker.InvokerRequest;

import java.io.IOException;

class Demo3_Invoker {
    public static void main(String[] args) throws IOException, InterruptedException {

        // invoker是sekiro推崇的sekiro的使用方案，
        // * 1.模式为ClientLB，在客户端进行Sekiro集群负载均衡，相对于http ng路由来说，少一层转发，减少服务器的带宽压力。服务器不需要存在网关层
        // * 2.天然keepAlive，链路只需要单次tcp连接建立，之后在tcp通道上完成所有的调用。对服务器的套接字资源几乎不存在占用
        // * 3.无解压器，节省服务器CPU资源。Sekiro->Sekiro模式下，报文在sekiro服务器上不会经过解压操作。
        // * 4.API封装，和对http接口封装相比更加简单。Sekiro相关的必要参数直接封装到API中了。同时避免java方向http网络库选择困难问题

        SekiroInvoker sekiroInvoker = new SekiroInvoker("7cd51507-cb3a-4a8a-aba2-4c6d66906e9d", new String[]{"sekiro.iinti.cn:5612"});
        InvokerRequest invokerRequest = new InvokerRequest.Builder()
                .group("test")
                .action("test")
                .field("param", "testparm")
                .build();

        String string = sekiroInvoker.newCall(invokerRequest).execute().string();

        System.out.println(string);
        Thread.sleep(20000);
        sekiroInvoker.destroy();
    }

}
