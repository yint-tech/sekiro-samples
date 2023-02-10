package cn.iinti.sekiro.demoapp;

import java.util.UUID;

import cn.iinti.sekiro3.business.api.SekiroClient;
import cn.iinti.sekiro3.business.api.interfaze.ActionHandler;
import cn.iinti.sekiro3.business.api.interfaze.SekiroRequest;
import cn.iinti.sekiro3.business.api.interfaze.SekiroResponse;
import de.robv.android.xposed.IXposedHookLoadPackage;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

public class XposedMain implements IXposedHookLoadPackage {
    public static XC_LoadPackage.LoadPackageParam loadPackageParam;

    @Override
    public void handleLoadPackage(XC_LoadPackage.LoadPackageParam loadPackageParam) throws Throwable {
        XposedMain.loadPackageParam = loadPackageParam;
        // 请注意，一般情况下我们只在主进程中启动sekiro服务
        // xposed本身支持多个进程注入hook，所以这里大部分情况判断下，只过滤到主进程
        if (loadPackageParam.packageName.equals(loadPackageParam.processName)) {
            // 请注意，一般sekiro只作用于特定的app
            if (loadPackageParam.packageName.equals("com.xxx.xxx")) {
                // xposed环境下使用sekiro
                //http://sekiro.iinti.cn/business/invoke?group=test&action=testAction&param=testparm
                new SekiroClient("test", UUID.randomUUID().toString())
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
                                })
                        ).start();
            }
        }
    }
}
