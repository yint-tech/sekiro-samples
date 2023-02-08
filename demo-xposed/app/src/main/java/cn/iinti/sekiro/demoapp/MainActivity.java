package cn.iinti.sekiro.demoapp;

import android.app.Activity;
import android.os.Bundle;
import android.support.annotation.Nullable;

import java.util.UUID;

import cn.iinti.sekiro3.business.api.SekiroClient;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        new Thread("start") {
            @Override
            public void run() {
                // 在普通Android应用中使用sekiro
                new SekiroClient("test-android", UUID.randomUUID().toString())
                        .setupSekiroRequestInitializer((sekiroRequest, handlerRegistry) -> handlerRegistry.registerSekiroHandler(new ClientTimeHandler()))
                        .start();
            }
        }.start();

    }
}
