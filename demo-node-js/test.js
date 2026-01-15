/**
 * Node.js Sekiro客户端使用示例
 */
const { SekiroClient, SekiroHandler } = require('./sekiro/SekiroClient');

// 定义一个处理器类
class TestHandler extends SekiroHandler {
    handle(request, response) {
        console.log('Handling request:', request);
        
        // 构造响应数据
        const responseData = {
            name: 'test-node',
            age: 10,
            request: request.param || 'no param',
            timestamp: Date.now(),
            action: request.action
        };
        
        // 成功响应
        response.success(responseData);
    }
}

class AnotherHandler extends SekiroHandler {
    handle(request, response) {
        console.log('Handling another request:', request);
        
        // 模拟一些异步操作
        setTimeout(() => {
            if (request.fail) {
                // 失败响应
                response.failed('This is a test failure');
            } else {
                // 成功响应
                response.success({
                    message: 'Successfully processed another action',
                    params: request,
                    processed_at: new Date().toISOString()
                });
            }
        }, 100);
    }
}

// 创建Sekiro客户端实例
const client = new SekiroClient('test-node', {
    host: 'sekiro.iinti.cn',
    port: 5612
});

// 注册处理器
client
    .registerAction('testAction', new TestHandler())
    .registerAction('anotherAction', new AnotherHandler())
    .start();

console.log('Sekiro client started, listening for requests...');
console.log('You can test with: http://sekiro.iinti.cn/business/invoke?group=test-node&action=testAction&param=testparam');

// 保持程序运行
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    client.stop();
    process.exit(0);
});