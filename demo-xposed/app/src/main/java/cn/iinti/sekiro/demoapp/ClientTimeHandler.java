package cn.iinti.sekiro.demoapp;


import cn.iinti.sekiro3.business.api.interfaze.Action;
import cn.iinti.sekiro3.business.api.interfaze.AutoBind;
import cn.iinti.sekiro3.business.api.interfaze.RequestHandler;
import cn.iinti.sekiro3.business.api.interfaze.SekiroRequest;
import cn.iinti.sekiro3.business.api.interfaze.SekiroResponse;

@Action("clientTime")
public class ClientTimeHandler implements RequestHandler {
    @AutoBind
    private String param1;

    @AutoBind
    private Integer sleep;

    @Override
    public void handleRequest(SekiroRequest sekiroRequest, SekiroResponse sekiroResponse) {
        if (sleep != null && sleep > 0) {
            try {
                Thread.sleep(sleep * 1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        sekiroResponse.success("process: " + XposedMain.loadPackageParam.processName + " : now:" + System.currentTimeMillis() + " your param1:" + param1);
    }
}
