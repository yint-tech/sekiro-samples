package cn.iinti.sekiro3;

import cn.iinti.sekiro3.business.api.ClusterSekiroClient;
import cn.iinti.sekiro3.business.api.interfaze.*;

/**
 * 注解是方便java开发优雅使用的各种封装，他能显著减少代码量：参数获取、参数检查、参数转换、默认值等
 */
public class Demo5_Annotation {
    public static void main(String[] args) throws InterruptedException {
        // http://sekiro.iinti.cn/business/invoke?group=test&action=test&sekiro_token=123
        ClusterSekiroClient sekiroClient = new ClusterSekiroClient("test", new String[]{"sekiro.iinti.cn:5612"})
                .setupSekiroRequestInitializer((sekiroRequest, handlerRegistry) ->
                        handlerRegistry.registerSekiroHandler(new AnnotationActionHandler())
                ).start();

        Thread.sleep(20000);

        sekiroClient.destroy(10);
    }

    /**
     * 使用注解表达action
     */
    @Action("test")
    public static class AnnotationActionHandler implements RequestHandler {

        /**
         * 使用注解完成参数和变量的绑定
         */
        @AutoBind(
                defaultValue = "defaultParam"// 当本字段缺失时，使用默认值："defaultParam"填充
        )
        private String param;

        /**
         * 字符串自动转换为数字
         */
        @AutoBind(defaultValue = "12")
        private Integer intParam;

        @AutoBind(
                value = "the_real_param",// 当requireParam和真实参数不一样时，使用value描述真实的字段名称
                require = true // 标记这个字段必传，缺失sekiro框架帮忙报错
        )
        private Double requireParam;

        @Override
        public void handleRequest(SekiroRequest sekiroRequest, SekiroResponse sekiroResponse) {
            sekiroResponse.success("param：" + param
                    + " intParam:" + intParam);
        }
    }
}
