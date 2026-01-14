# Sekiro Node.js SDK（AI自动生成的）

Node.js 版本的 Sekiro 客户端 SDK，用于在 Node.js 环境中使用 Sekiro RPC 框架。

## 安装

```bash
npm install
```

## 使用方法

### 基本使用

```javascript
const { SekiroClient, SekiroHandler } = require('./sekiro/SekiroClient');

// 定义处理器
class MyHandler extends SekiroHandler {
    handle(request, response) {
        // 处理请求逻辑
        const result = {
            message: 'Hello from Node.js',
            params: request,
            timestamp: Date.now()
        };
        
        // 返回成功响应
        response.success(result);
    }
}

// 创建客户端实例
const client = new SekiroClient('my-group', {
    host: 'sekiro.iinti.cn',
    port: 5612
});

// 注册处理器
client
    .registerAction('myAction', new MyHandler())
    .start();
```

### 高级配置

```javascript
const client = new SekiroClient('my-group', {
    host: 'custom-server.com',  // 自定义服务器地址
    port: 5612,                 // 自定义端口
    clientId: 'custom-id'       // 自定义客户端ID
});
```

## API 文档

### SekiroClient

- `constructor(group, options)` - 创建客户端实例
  - `group`: 分组名称
  - `options`: 配置选项
    - `host`: 服务器地址，默认 'sekiro.iinti.cn'
    - `port`: 服务器端口，默认 5612
    - `clientId`: 客户端ID，可选，如果不提供则自动生成

- `registerAction(action, handler)` - 注册动作处理器
- `start()` - 启动客户端
- `stop()` - 停止客户端
- `isActive()` - 检查客户端是否活跃

### SekiroHandler

- `handle(request, response)` - 处理请求的方法
  - `request`: 请求对象，包含客户端传递的参数
  - `response`: 响应对象，用于返回结果

### SekiroResponse

- `success(data)` - 返回成功响应
- `failed(message)` - 返回失败响应

## 示例

运行示例:

```bash
npm start
```

或者

```bash
node test.js
```

## 协议说明

Sekiro 使用私有长连接协议，基于 TCP 实现。协议特点：

1. 长连接，减少连接建立开销
2. 支持心跳机制，确保连接有效性
3. 支持多种消息类型
4. 高效的二进制编码

## 错误处理

SDK 会自动处理网络异常和重连逻辑。当连接断开时，SDK 会自动尝试重连。

## 许可证

MIT