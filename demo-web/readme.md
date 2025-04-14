# Js-Web

如果你想讲将Sekio用于浏览器环境（或者类浏览器环境中，如weex、react、微信小程序、webview等），那么可以使用Sekiro为js提供的接入方案。

在浏览器环境中，js不具备直接操作socket的能力，在web环境中，sekiro通过websocket的方式进行服务器通信。由于历史协议设计缘故，web环境中依然使用的json字符串作为协议沟通。



## 上手使用

打开chrome控制台，输入如下代码：

```javascript
function SekiroClient(e){if(this.wsURL=e,this.handlers={},this.socket={},!e)throw new Error("wsURL can not be empty!!");this.webSocketFactory=this.resolveWebSocketFactory(),this.connect()}SekiroClient.prototype.resolveWebSocketFactory=function(){if("object"==typeof window){var e=window.WebSocket?window.WebSocket:window.MozWebSocket;return function(o){function t(o){this.mSocket=new e(o)}return t.prototype.close=function(){this.mSocket.close()},t.prototype.onmessage=function(e){this.mSocket.onmessage=e},t.prototype.onopen=function(e){this.mSocket.onopen=e},t.prototype.onclose=function(e){this.mSocket.onclose=e},t.prototype.send=function(e){this.mSocket.send(e)},new t(o)}}if("object"==typeof weex)try{console.log("test webSocket for weex");var o=weex.requireModule("webSocket");return console.log("find webSocket for weex:"+o),function(e){try{o.close()}catch(e){}return o.WebSocket(e,""),o}}catch(e){console.log(e)}if("object"==typeof WebSocket)return function(o){return new e(o)};throw new Error("the js environment do not support websocket")},SekiroClient.prototype.connect=function(){console.log("sekiro: begin of connect to wsURL: "+this.wsURL);var e=this;try{this.socket=this.webSocketFactory(this.wsURL)}catch(o){return console.log("sekiro: create connection failed,reconnect after 2s:"+o),void setTimeout(function(){e.connect()},2e3)}this.socket.onmessage(function(o){e.handleSekiroRequest(o.data)}),this.socket.onopen(function(e){console.log("sekiro: open a sekiro client connection")}),this.socket.onclose(function(o){console.log("sekiro: disconnected ,reconnection after 2s"),setTimeout(function(){e.connect()},2e3)})},SekiroClient.prototype.handleSekiroRequest=function(e){console.log("receive sekiro request: "+e);var o=JSON.parse(e),t=o.__sekiro_seq__;if(o.action){var n=o.action;if(this.handlers[n]){var s=this.handlers[n],i=this;try{s(o,function(e){try{i.sendSuccess(t,e)}catch(e){i.sendFailed(t,"e:"+e)}},function(e){i.sendFailed(t,e)})}catch(e){console.log("error: "+e),i.sendFailed(t,":"+e)}}else this.sendFailed(t,"no action handler: "+n+" defined")}else this.sendFailed(t,"need request param {action}")},SekiroClient.prototype.sendSuccess=function(e,o){var t;if("string"==typeof o)try{t=JSON.parse(o)}catch(e){(t={}).data=o}else"object"==typeof o?t=o:(t={}).data=o;(Array.isArray(t)||"string"==typeof t)&&(t={data:t,code:0}),t.code?t.code=0:(t.status,t.status=0),t.__sekiro_seq__=e;var n=JSON.stringify(t);console.log("response :"+n),this.socket.send(n)},SekiroClient.prototype.sendFailed=function(e,o){"string"!=typeof o&&(o=JSON.stringify(o));var t={};t.message=o,t.status=-1,t.__sekiro_seq__=e;var n=JSON.stringify(t);console.log("sekiro: response :"+n),this.socket.send(n)},SekiroClient.prototype.registerAction=function(e,o){if("string"!=typeof e)throw new Error("an action must be string");if("function"!=typeof o)throw new Error("a handler must be function");return console.log("sekiro: register action: "+e),this.handlers[e]=o,this};
var client = new SekiroClient("wss://sekiro.iinti.cn:5612/business/register?group=test_web&clientId=" + Math.random());
client.registerAction("testAction", function (request, resolve, reject) {
    resolve("ok");
});
``` 

访问JsRPC链接:

[https://sekiro.iinti.cn/business/invoke?group=test_web&action=testAction&param=testparm](https://sekiro.iinti.cn/business/invoke?group=test_web&action=testAction&param=testparm)

## API接口

### 指定服务连接参数

创建SekiroClient的时候，通过url指定连接参数：

``wss://sekiro.iinti.cn:5612/business/register?group=test_web&clientId=``

- **请注意，如果是https网站，则需必须使用wss://协议，开源版本需要自行使用nginx之类的中间件完成wss的支持**
- **浏览器对于数据访问有比较多的权限控制，对于有一些存在csp拦截的网站，请参考web环境ssl注入相关指引：[sslForWebsocket](https://sekiro.iinti.cn/sekiro-doc/02_advance/03_sslForWebsocket.html)**

### Sekiro处理器

连接到sekiro服务器之后，需要接受服务器转发过来的参数，然后书写参数处理逻辑，并且返回处理结果。如下demo：

```javascript
client.registerAction("testAction",
    function (request, resolve, reject) {
        resolve("ok");
    }
);
```

- 调用registerAction，实现一个handler的注册
- request代表的请求参数：如``group=test_web&action=testAction&param=testparm``,则上述代码可以通过``request``获取到这些参数：``console.log(request.param)``
- 返回成功数据：``resolve(xxxx);``其中xxxx代表你想返回的任意正确数据内容
- 返回错误数据：``reject("错误ddd");``，reject函数调用需要是一个字符串。框架通过成功和失败在中心服务器提供简单的统计功能

## 油猴脚本集成

参考: [](./blt.js)