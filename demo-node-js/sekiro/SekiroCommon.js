/**
 * Sekiro协议相关的通用组件
 */

const net = require('net');

// MAGIC number: 0x73656b69726f3031 (sekiro01)
const MAGIC = BigInt('0x73656b69726f3031');
const MAGIC_BUFFER = Buffer.allocUnsafe(8);
MAGIC_BUFFER.writeBigInt64BE(MAGIC);

// 消息类型定义
const MessageType = {
    TypeHeartbeat: 0x00,
    CTypeRegister: 0x10,
    CTypeInvokeResponse: 0x11,
    CTypeOffline: 0x12,
    CTypeCmdResponse: 0x13,
    CTypeInvokeStreamClose: 0x14,
    STypeInvoke: 0x20,
    STypeCmd: 0x21,
    STypeOfflineResponse: 0x22,
    STypeInvokeResponse: 0x23,
    STypeInvokeConnected: 0x24,
    ITypeConnect: 0x30,
    ITypeInvoke: 0x31
};

class SekiroPacket {
    constructor() {
        this.messageType = -1;
        this.seq = -1;
        this.headers = {};
        this.data = null;
    }

    addHeader(key, value) {
        this.headers[key] = value;
        return this;
    }

    /**
     * 将SekiroPacket编码为字节流
     */
    encode() {
        let bodyLength = 1 + 4 + 1; // messageType(1) + seq(4) + headerSize(1)
        
        const headerByteArray = [];
        for (const [key, value] of Object.entries(this.headers)) {
            const keyBytes = Buffer.from(key, 'utf8');
            const valueBytes = Buffer.from(value, 'utf8');
            bodyLength += 2; // keyLen(1) + valueLen(1)
            bodyLength += keyBytes.length;
            bodyLength += valueBytes.length;
            
            headerByteArray.push(keyBytes);
            headerByteArray.push(valueBytes);
        }

        if (this.data) {
            bodyLength += this.data.length;
        }

        const buf = Buffer.allocUnsafe(8 + 4 + bodyLength); // magic(8) + bodyLength(4) + body
        
        // 写入MAGIC
        MAGIC_BUFFER.copy(buf, 0);
        
        // 写入body长度
        buf.writeInt32BE(bodyLength, 8);
        
        // 写入消息类型
        buf.writeInt8(this.messageType, 12);
        
        // 写入序列号
        buf.writeInt32BE(this.seq, 13);
        
        // 写入头部数量
        buf.writeInt8(Object.keys(this.headers).length, 17);
        
        let offset = 18;
        
        // 写入头部
        for (const headerItem of headerByteArray) {
            buf.writeInt8(headerItem.length, offset);
            offset++;
            headerItem.copy(buf, offset);
            offset += headerItem.length;
        }
        
        // 写入数据
        if (this.data && this.data.length > 0) {
            this.data.copy(buf, offset);
        }

        return buf;
    }

    /**
     * 从字节流解码SekiroPacket
     */
    static decode(data) {
        const packet = new SekiroPacket();
        
        let offset = 0;
        
        // 读取消息类型
        packet.messageType = data.readInt8(offset);
        offset++;
        
        // 读取序列号
        packet.seq = data.readInt32BE(offset);
        offset += 4;
        
        // 读取头部大小
        const headerSize = data.readInt8(offset);
        offset++;
        
        // 读取头部
        for (let i = 0; i < headerSize; i++) {
            // 读取key长度
            const keyLength = data.readInt8(offset);
            offset++;
            
            // 读取key内容
            const key = data.slice(offset, offset + keyLength).toString('utf8');
            offset += keyLength;
            
            // 读取value长度
            const valueLength = data.readInt8(offset);
            offset++;
            
            // 读取value内容
            const value = data.slice(offset, offset + valueLength).toString('utf8');
            offset += valueLength;
            
            packet.headers[key] = value;
        }
        
        // 剩余部分是数据
        if (offset < data.length) {
            packet.data = data.slice(offset);
        }
        
        return packet;
    }
}

/**
 * 通用响应类
 */
class CommonRes {
    constructor() {
        this.status = null;
        this.message = "";
        this.data = null;
    }

    ok(data) {
        this.status = 0;
        this.message = "";
        this.data = data;
        return this;
    }

    failed(message) {
        this.status = -1;
        this.message = message;
        this.data = null;
        return this;
    }

    /**
     * 编码为Sekiro Fast JSON格式
     */
    encodeSekiroFastJson() {
        const msgPart = this.message ? Buffer.from(this.message, 'utf8') : null;
        const msgPartLen = msgPart ? msgPart.length : 0;

        const jsonPart = this.data ? Buffer.from(JSON.stringify(this.data), 'utf8') : null;
        const jsonPartLen = jsonPart ? jsonPart.length : 0;

        const buf = Buffer.allocUnsafe(4 + 4 + (msgPartLen || 0) + 4 + (jsonPartLen || 0));

        let offset = 0;
        
        // 写入状态
        buf.writeInt32BE(this.status, offset);
        offset += 4;
        
        // 写入消息长度和内容
        buf.writeInt32BE(msgPartLen, offset);
        offset += 4;
        if (msgPart) {
            msgPart.copy(buf, offset);
            offset += msgPartLen;
        }
        
        // 写入JSON长度和内容
        buf.writeInt32BE(jsonPartLen, offset);
        offset += 4;
        if (jsonPart) {
            jsonPart.copy(buf, offset);
        }

        return buf;
    }

    /**
     * 从Sekiro Fast JSON格式解码
     */
    static decodeSekiroFastJson(data) {
        const res = new CommonRes();
        
        let offset = 0;
        
        // 读取状态
        res.status = data.readInt32BE(offset);
        offset += 4;
        
        // 读取消息长度
        const msgPartLen = data.readInt32BE(offset);
        offset += 4;
        
        // 读取消息内容
        if (msgPartLen > 0) {
            res.message = data.slice(offset, offset + msgPartLen).toString('utf8');
            offset += msgPartLen;
        }
        
        // 读取JSON长度
        const jsonPartLen = data.readInt32BE(offset);
        offset += 4;
        
        // 读取JSON内容
        if (jsonPartLen > 0) {
            const jsonStr = data.slice(offset, offset + jsonPartLen).toString('utf8');
            res.data = JSON.parse(jsonStr);
        }
        
        return res;
    }
}

module.exports = {
    SekiroPacket,
    CommonRes,
    MessageType,
    MAGIC,
    MAGIC_BUFFER
};