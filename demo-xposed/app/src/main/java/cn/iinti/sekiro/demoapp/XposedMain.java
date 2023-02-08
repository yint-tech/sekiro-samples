package cn.iinti.sekiro.demoapp;

import java.util.UUID;

import cn.iinti.sekiro3.business.api.SekiroClient;
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
                new SekiroClient("test-xposed", UUID.randomUUID().toString())
                        .setupSekiroRequestInitializer((sekiroRequest, handlerRegistry) -> handlerRegistry.registerSekiroHandler(new ClientTimeHandler()))
                        .start();
            }
        }
    }
}
