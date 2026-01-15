/**
 * Node.js版Sekiro客户端
 */
const net = require('net');
const {
    v4: uuidv4
} = require('uuid');
const {
    SekiroPacket,
    CommonRes,
    MessageType,
    MAGIC
} = require('./SekiroCommon');

class SekiroResponse {
    constructor(connection, seq) {
        this.connection = connection;
        this.seq = seq;
        this.responded = false;
    }

    success(data) {
        this._response(new CommonRes().ok(data));
    }

    failed(message) {
        this._response(new CommonRes().failed(message));
    }

    _response(commonRes) {
        if (this.responded) {
            return;
        }
        this.responded = true;

        const responsePkg = new SekiroPacket()
            .addHeader("PAYLOAD_CONTENT_TYPE", "CONTENT_TYPE_SEKIRO_FAST_JSON");

        responsePkg.messageType = MessageType.CTypeInvokeResponse;
        responsePkg.seq = this.seq;
        responsePkg.data = commonRes.encodeSekiroFastJson();

        this.connection.write(responsePkg.encode());

        const message = JSON.stringify({
            status: commonRes.status,
            message: commonRes.message,
            data: commonRes.data
        });

        console.log('sekiro response: ', message);
    }
}

class SekiroHandler {
    /**
     * 处理请求的方法
     * @param {Object} request - 请求参数
     * @param {SekiroResponse} response - 响应对象
     */
    handle(request, response) {
        // 子类需要实现此方法
    }
}

class SekiroClient {
    constructor(group, options = {}) {
        const {
            host = 'sekiro.iinti.cn',
                port = 5612,
                clientId = null
        } = options;

        this.group = group;
        this.host = host;
        this.port = port;
        this.clientId = clientId || uuidv4();
        this.handlers = {};
        this.active = false;
        this.connection = null;
        this.reconnectInterval = 5000; // 重连间隔5秒
        this.buffer = Buffer.alloc(0); // 数据缓冲区，用于处理粘包和拆包

        console.log(`       welcome to use sekiro framework
for more support please visit our website: https://iinti.cn`);
    }

    /**
     * 注册动作处理器
     */
    registerAction(action, handler) {
        if (!(handler instanceof SekiroHandler)) {
            throw new Error('Handler must be an instance of SekiroHandler');
        }
        this.handlers[action] = handler;
        return this;
    }

    /**
     * 创建注册包
     */
    makeRegisterPkg() {
        const registerCmd = new SekiroPacket();
        registerCmd.messageType = MessageType.CTypeRegister;
        registerCmd.seq = -1;
        registerCmd.addHeader("SEKIRO_GROUP", this.group);
        registerCmd.addHeader("SEKIRO_CLIENT_ID", this.clientId);
        return registerCmd;
    }

    /**
     * 处理接收到的数据包
     */
    handlePacket(sekiroPacket, connection) {
        // 心跳包处理
        if (sekiroPacket.messageType === MessageType.TypeHeartbeat) {
            // 回复心跳包
            connection.write(sekiroPacket.encode());
            return;
        }

        // 只处理调用类型的包
        if (sekiroPacket.messageType !== MessageType.STypeInvoke) {
            console.log(`unknown server msg type: ${sekiroPacket.messageType}`);
            return;
        }

        const sekiroResponse = new SekiroResponse(connection, sekiroPacket.seq);

        if (!sekiroPacket.data) {
            sekiroResponse.failed("sekiro system error, no request payload present!!");
            return;
        }

        try {
            const requestStr = sekiroPacket.data.toString('utf-8');
            console.log('sekiro receive request: ', requestStr);

            const request = JSON.parse(requestStr);
            const action = request.action;

            if (!action) {
                sekiroResponse.failed("the param: {action} not presented!!");
                return;
            }

            const handler = this.handlers[action];
            if (!handler) {
                sekiroResponse.failed("sekiro no handler for this action: " + action);
                return;
            }

            // 异步处理请求，避免阻塞
            setImmediate(() => {
                try {
                    handler.handle(request, sekiroResponse);
                } catch (error) {
                    console.error("Error handling request:", error);
                    sekiroResponse.failed("failed: " + error.message);
                }
            });
        } catch (error) {
            console.error("Error processing request:", error);
            sekiroResponse.failed("failed to parse request: " + error.message);
        }
    }

    /**
     * 启动客户端
     */
    start() {
        if (this.active) {
            return this;
        }

        this.active = true;
        this._connect();
        return this;
    }

    /**
     * 建立连接
     */
    _connect() {
        if (!this.active) {
            return;
        }

        console.log(`begin connect to ${this.host}:${this.port} with clientId: ${this.clientId}`);

        const connection = net.createConnection({
            host: this.host,
            port: this.port
        });

        connection.on('connect', () => {
            console.log('Connected to sekiro server');
            this.connection = connection;
            this.buffer = Buffer.alloc(0); // 重置缓冲区

            // 发送注册命令
            const registerPkg = this.makeRegisterPkg();
            connection.write(registerPkg.encode());
        });

        connection.on('data', (data) => {
            this._handleData(data, connection);
        });

        connection.on('error', (err) => {
            console.log('Connection error:', err.message);
        });

        connection.on('close', () => {
            console.log('Connection closed, prepare to reconnect');
            this.connection = null;
            this.buffer = Buffer.alloc(0); // 重置缓冲区
            if (this.active) {
                setTimeout(() => {
                    if (this.active) {
                        this._connect();
                    }
                }, this.reconnectInterval);
            }
        });
    }

    /**
     * 处理接收的数据
     */
    _handleData(data, connection) {
        // 将新接收的数据追加到缓冲区
        this.buffer = Buffer.concat([this.buffer, data]);

        // 循环处理缓冲区中的完整数据包
        while (this.buffer.length >= 12) { // 至少需要 8 bytes magic + 4 bytes length
            // 读取并验证MAGIC
            const headBuffer = this.buffer.slice(0, 12);
            const magic = headBuffer.readBigInt64BE();

            if (magic !== MAGIC) {
                console.error(`Protocol error, magic expected: ${MAGIC}, actually: ${magic}`);
                this.buffer = Buffer.alloc(0);
                connection.destroy();
                return;
            }

            // 读取body长度
            const bodyLength = headBuffer.readInt32BE(8);

            // 检查body长度是否合理（防止恶意数据）
            if (bodyLength < 0 || bodyLength > 10 * 1024 * 1024) { // 最大10MB
                console.error(`Invalid body length: ${bodyLength}`);
                this.buffer = Buffer.alloc(0);
                connection.destroy();
                return;
            }

            // 检查是否接收到了完整的包
            const totalPacketLength = 12 + bodyLength;
            if (this.buffer.length < totalPacketLength) {
                // 数据不完整，等待更多数据
                return;
            }

            // 提取body数据
            const bodyData = this.buffer.slice(12, 12 + bodyLength);

            try {
                // 解析数据包
                const sekiroPacket = SekiroPacket.decode(bodyData);

                // 处理数据包
                this.handlePacket(sekiroPacket, connection);
            } catch (error) {
                console.error('Error decoding packet:', error);
                // 跳过这个包，继续处理下一个
            }

            // 从缓冲区中移除已处理的数据
            this.buffer = this.buffer.slice(totalPacketLength);
        }
    }

    /**
     * 停止客户端
     */
    stop() {
        this.active = false;
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        return this;
    }

    /**
     * 检查客户端是否活跃
     */
    isActive() {
        return this.active && this.connection && !this.connection.destroyed;
    }
}

module.exports = {
    SekiroClient,
    SekiroHandler,
    SekiroResponse
};