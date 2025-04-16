# sekiro java样例

主要场景：

在内网电脑提供java的API服务，外漏给其他业务使用

## 样例代码


maven仓库

```xml
    <dependencies>
        <dependency>
            <groupId>cn.iinti.sekiro3.business</groupId>
            <artifactId>sekiro-business-api</artifactId>
            <version>1.6</version>
        </dependency>
    </dependencies>

    <repositories>
        <repository>
            <id>int-public</id>
            <name>int public maven</name>
            <url>https://nexus.iinti.cn/repository/maven-public/</url>
            <releases>
                <enabled>true</enabled>
            </releases>
            <snapshots>
                <enabled>false</enabled>
            </snapshots>
        </repository>
    </repositories>
```

代码集成

```java
package cn.iinti.sekiro3;

import cn.iinti.sekiro3.business.api.SekiroClient;
import cn.iinti.sekiro3.business.api.interfaze.*;

public class Demo1_SingleServer {

    public class TestResponse
    {
        public String name;

        private Integer age;

        private String request;

        public Integer getAge() {
            return age;
        }

        public String getRequest() {
            return request;
        }

        public void setRequest(String request) {
            this.request = request;
        }

      public void setAge(Integer age) {
            this.age = age;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        
    }

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
                                // 接口处理逻辑，我们返回一个对象
                                TestResponse testResult = new Demo1_SingleServer().new TestResponse();
                                testResult.setAge(10);
                                testResult.setName("test");
                                testResult.setRequest(sekiroRequest.getString("param"));
                                sekiroResponse.success(testResult);

                                // 接口处理逻辑，我们不做任何处理，直接返回字符串：ok
                                // sekiroResponse.success("ok");
                            }
                        })
                ).start();
        Thread.sleep(20000);
    }
}

```

## 安卓测集成说明

- 安卓9之后主进程不允许直接开启网络请求，需要开启独立线程进行SekiroClient初始化

## android sdk集成报错请参考

```gradle
packaging {
        resources {
            excludes.add("META-INF/INDEX.LIST")
            excludes.add("META-INF/io.netty.versions.properties")
        }
    }
```