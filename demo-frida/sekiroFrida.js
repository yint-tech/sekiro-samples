"use strict";
exports.__esModule = true;
/**
 * sekiro client base on frida socket api: https://frida.re/docs/javascript-api/#socket
 * sekiro socket internal protocol document: http://sekiro.iinti.cn/sekiro-doc/03_developer/1.protocol.html
 */
var SekiroClient = /** @class */ (function () {
    function SekiroClient(sekiroOption) {
        this.handlers = {};
        this.isConnecting = false;
        this.sekiroOption = sekiroOption;
        sekiroOption.serverHost = sekiroOption.serverHost || "sekiro.iinti.cn";
        sekiroOption.serverPort = sekiroOption.serverPort || 5612;
        this.fridaSocketConfig = {
            family: "ipv4",
            host: sekiroOption.serverHost,
            port: sekiroOption.serverPort
        };
        console.log("           welcome to use sekiro framework,\n" +
            "      for more support please visit our website: https://iinti.cn\n");
        this.doConnect();
    }
    SekiroClient.prototype.registerAction = function (action, handle) {
        this.handlers[action] = handle;
    };
    SekiroClient.prototype.reConnect = function () {
        var _this = this;
        console.log("sekiro try connection after 5s");
        setTimeout(function () { return _this.doConnect(); }, 5000);
    };
    SekiroClient.prototype.doConnect = function () {
        var _this = this;
        if (this.isConnecting) {
            return;
        }
        this.isConnecting = true;
        console.log("sekiro connect to server-> "
            + this.fridaSocketConfig.host + ":" + this.fridaSocketConfig.port);
        Socket.connect(this.fridaSocketConfig)
            .then(function (connection) {
            _this.isConnecting = false;
            connection.setNoDelay(true); // no delay, sekiro packet has complement message block
            _this.connRead(connection);
            _this.connWrite(connection, {
                type: 0x10,
                serialNumber: -1,
                headers: {
                    'SEKIRO_GROUP': _this.sekiroOption.sekiroGroup,
                    'SEKIRO_CLIENT_ID': _this.sekiroOption.clientId
                }
            });
        })["catch"](function (reason) {
            _this.isConnecting = false;
            console.log("sekiro connect failed", reason);
            _this.reConnect();
        });
    };
    SekiroClient.prototype.connWrite = function (conn, sekiroPacket) {
        var _this = this;
        conn.output.write(this.encodeSekiroPacket(sekiroPacket))["catch"](function (reason) {
            console.log("sekiro write register cmd failed", reason);
            _this.reConnect();
        });
    };
    SekiroClient.prototype.connRead = function (conn) {
        var _this = this;
        conn.input.read(1024)
            .then(function (buffer) {
            if (buffer.byteLength <= 0) {
                conn.close()["finally"](function () {
                    console.log("sekiro server lost!");
                    _this.reConnect();
                });
                return;
            }
            _this.onServerData(conn, buffer);
            setImmediate(function () {
                _this.connRead(conn);
            });
        })["catch"](function (reason) {
            console.log("sekiro read_loop error", reason);
            _this.reConnect();
        });
    };
    SekiroClient.prototype.onServerData = function (conn, buffer) {
        var _this = this;
        // merge buffer data
        if (!this.readBuffer) {
            if (!buffer) {
                return;
            }
            this.readBuffer = buffer;
        }
        else if (!!buffer) {
            var merge = new ArrayBuffer(this.readBuffer.byteLength + buffer.byteLength);
            var view = new Uint8Array(merge);
            view.set(new Uint8Array(this.readBuffer), 0);
            view.set(new Uint8Array(buffer), this.readBuffer.byteLength);
            this.readBuffer = merge;
        }
        var pkt = this.decodeSekiroPacket(conn);
        if (!!pkt) {
            this.handleServerPkg(conn, pkt);
            //maybe more data can be decoded
            setImmediate(function () { return _this.onServerData(conn); });
        }
    };
    SekiroClient.prototype.encodeSekiroFastJSON = function (commonRes) {
        var msgPart = undefined;
        if (commonRes.msg) {
            msgPart = this.str2Uint8(commonRes.msg);
        }
        var jsonPart = undefined;
        if (commonRes.data) {
            jsonPart = this.str2Uint8(JSON.stringify(commonRes.data));
        }
        var contentLen = 4 + 4 + (msgPart ? msgPart.length : 0)
            + 4 + (jsonPart ? jsonPart.length : 0);
        var arrayBuffer = new ArrayBuffer(contentLen);
        var v = new DataView(arrayBuffer);
        v.setInt32(0, commonRes.status);
        v.setInt32(4, msgPart ? msgPart.length : 0);
        var cursor = 8;
        if (msgPart) {
            new Uint8Array(arrayBuffer, 8).set(msgPart);
            cursor += msgPart.length;
        }
        v.setInt32(cursor, jsonPart ? jsonPart.length : 0);
        cursor += 4;
        if (jsonPart) {
            new Uint8Array(arrayBuffer, cursor).set(jsonPart);
        }
        return arrayBuffer;
    };
    SekiroClient.prototype.handleServerPkg = function (conn, pkt) {
        if (pkt.type == 0x00) {
            // this is heart beat pkg
            this.connWrite(conn, pkt);
            return;
        }
        if (pkt.type != 0x20) {
            console.log("unknown server message:" + JSON.stringify(pkt));
            return;
        }
        var that = this;
        var writeInvokeResponse = function (json) {
            setImmediate(function () {
                that.connWrite(conn, {
                    type: 0x11, serialNumber: pkt.serialNumber,
                    headers: { "PAYLOAD_CONTENT_TYPE": "CONTENT_TYPE_SEKIRO_FAST_JSON" },
                    data: that.encodeSekiroFastJSON(json)
                });
            });
        };
        var resolve = function (data) {
            writeInvokeResponse({ status: 0, data: data });
        };
        var reject = function (msg) {
            writeInvokeResponse({ status: -1, msg: msg });
        };
        if (!pkt.data) {
            reject("sekiro system error, no request payload present!!");
            return;
        }
        var requestStr = this.uint8toStr(new Uint8Array(pkt.data));
        console.log("sekiro receive request: " + requestStr);
        var requestJSON = JSON.parse(requestStr);
        if (!requestJSON['action']) {
            reject("the param: {action} not presented!!");
            return;
        }
        var handler = this.handlers[requestJSON['action']];
        if (!handler) {
            reject("sekiro no handler for this action");
            return;
        }
        try {
            handler(requestJSON, resolve, reject);
        }
        catch (e) {
            reject("sekiro handler error:" + e + JSON.stringify(e));
        }
    };
    SekiroClient.prototype.decodeSekiroPacket = function (conn) {
        if (!this.readBuffer) {
            return undefined;
        }
        var v = new DataView(this.readBuffer);
        var magic1 = v.getInt32(0);
        var magic2 = v.getInt32(4);
        if (magic1 != 0x73656b69 || magic2 != 0x726f3031) {
            console.log("sekiro packet data");
            conn.close().then(function () {
                console.log("sekiro close broken pipe");
            });
            this.readBuffer = undefined;
            return;
        }
        var pkgLength = v.getInt32(8);
        if (this.readBuffer.byteLength < pkgLength + 12) {
            return; // not enough data,wait next read event
        }
        var type = v.getInt8(12);
        var seq = v.getInt32(13);
        var headerSize = v.getInt8(17);
        var cursor = 18;
        var headers = {};
        for (var i = 0; i < headerSize; i++) {
            var keyLen = v.getInt8(cursor++);
            var key = this.uint8toStr(new Uint8Array(this.readBuffer.slice(cursor, keyLen)));
            cursor += keyLen;
            var valueLen = v.getInt8(cursor++);
            var value = "";
            if (valueLen > 0) {
                value = this.uint8toStr(new Uint8Array(this.readBuffer.slice(cursor, valueLen)));
                cursor += valueLen;
            }
            headers[key] = value;
        }
        var data = undefined;
        var dataPayloadLen = (pkgLength + 12 - cursor);
        if (dataPayloadLen > 0) {
            data = this.readBuffer.slice(cursor, cursor + dataPayloadLen);
        }
        if (this.readBuffer.byteLength == pkgLength + 12) {
            this.readBuffer = undefined;
        }
        else {
            this.readBuffer = this.readBuffer.slice(cursor);
        }
        return {
            type: type,
            serialNumber: seq,
            headers: headers,
            data: data
        };
    };
    SekiroClient.prototype.encodeSekiroPacket = function (sekiroPacket) {
        var num = 6; // 1 + 4 + 1
        var headerList = [];
        for (var h in sekiroPacket.headers) {
            headerList.push(this.str2Uint8(h));
            headerList.push(this.str2Uint8(sekiroPacket.headers[h]));
            num += 2;
        }
        num += headerList.reduce(function (res, it) { return res + it.length; }, 0);
        if (sekiroPacket.data) {
            num += sekiroPacket.data.byteLength;
        }
        var buffer = new ArrayBuffer(num + 12);
        var dataView = new DataView(buffer);
        dataView.setUint32(0, 0x73656b69); // seki
        dataView.setUint32(4, 0x726f3031); // ro01
        dataView.setInt32(8, num); // payload length
        dataView.setInt8(12, sekiroPacket.type); // 1 pkg type
        dataView.setInt32(13, sekiroPacket.serialNumber); // 4 seq
        dataView.setInt8(17, Object.keys(sekiroPacket.headers).length); //1
        var cursor = 18;
        headerList.forEach(function (header) {
            dataView.setInt8(cursor++, header.length);
            new Uint8Array(buffer, cursor).set(header);
            cursor += header.length;
        });
        if (sekiroPacket.data) {
            new Uint8Array(buffer, cursor).set(new Uint8Array(sekiroPacket.data));
        }
        return buffer;
    };
    // the frida js runtime do not support TextEncoder/TextDecoder to handle transfer between ArrayBuffer and string
    // in node: Buffer.from(string)
    // in browser: encodeURLComponent or XHR with blob
    // this component extracted from https://github.com/samthor/fast-text-encoding/blob/master/src/lowlevel.js
    SekiroClient.prototype.uint8toStr = function (bytes) {
        var byte3;
        var byte2;
        var inputIndex = 0;
        var pendingSize = Math.min(256 * 256, bytes.length + 1);
        var pending = new Uint16Array(pendingSize);
        var chunks = [];
        var pendingIndex = 0;
        var _loop_1 = function () {
            var more = inputIndex < bytes.length;
            if (!more || (pendingIndex >= pendingSize - 1)) {
                var subarray = pending.subarray(0, pendingIndex);
                var temp_1 = [];
                subarray.forEach(function (item) { return temp_1.push(item); });
                chunks.push(String.fromCharCode.apply(null, temp_1));
                if (!more) {
                    return { value: chunks.join('') };
                }
                bytes = bytes.subarray(inputIndex);
                inputIndex = 0;
                pendingIndex = 0;
            }
            var byte1 = bytes[inputIndex++];
            if ((byte1 & 0x80) === 0) { // 1-byte or null
                pending[pendingIndex++] = byte1;
            }
            else if ((byte1 & 0xe0) === 0xc0) { // 2-byte
                byte2 = bytes[inputIndex++] & 0x3f;
                pending[pendingIndex++] = ((byte1 & 0x1f) << 6) | byte2;
            }
            else if ((byte1 & 0xf0) === 0xe0) { // 3-byte
                byte2 = bytes[inputIndex++] & 0x3f;
                byte3 = bytes[inputIndex++] & 0x3f;
                pending[pendingIndex++] = ((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3;
            }
            else if ((byte1 & 0xf8) === 0xf0) { // 4-byte
                byte2 = bytes[inputIndex++] & 0x3f;
                byte3 = bytes[inputIndex++] & 0x3f;
                var byte4 = bytes[inputIndex++] & 0x3f;
                // this can be > 0xffff, so possibly generate surrogates
                var codepoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
                if (codepoint > 0xffff) {
                    // codepoint &= ~0x10000;
                    codepoint -= 0x10000;
                    pending[pendingIndex++] = (codepoint >>> 10) & 0x3ff | 0xd800;
                    codepoint = 0xdc00 | codepoint & 0x3ff;
                }
                pending[pendingIndex++] = codepoint;
            }
            else {
                // invalid initial byte
            }
        };
        for (;;) {
            var state_1 = _loop_1();
            if (typeof state_1 === "object")
                return state_1.value;
        }
    };
    SekiroClient.prototype.str2Uint8 = function (string) {
        var pos = 0;
        var len = string.length;
        var at = 0; // output position
        var tlen = Math.max(32, len + (len >>> 1) + 7); // 1.5x size
        var target = new Uint8Array((tlen >>> 3) << 3); // ... but at 8 byte offset
        while (pos < len) {
            var value = string.charCodeAt(pos++);
            if (value >= 0xd800 && value <= 0xdbff) {
                // high surrogate
                if (pos < len) {
                    var extra = string.charCodeAt(pos);
                    if ((extra & 0xfc00) === 0xdc00) {
                        ++pos;
                        value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                    }
                }
                if (value >= 0xd800 && value <= 0xdbff) {
                    continue; // drop lone surrogate
                }
            }
            // expand the buffer if we couldn't write 4 bytes
            if (at + 4 > target.length) {
                tlen += 8; // minimum extra
                tlen *= (1.0 + (pos / string.length) * 2); // take 2x the remaining
                tlen = (tlen >>> 3) << 3; // 8 byte offset
                var update = new Uint8Array(tlen);
                update.set(target);
                target = update;
            }
            if ((value & 0xffffff80) === 0) { // 1-byte
                target[at++] = value; // ASCII
                continue;
            }
            else if ((value & 0xfffff800) === 0) { // 2-byte
                target[at++] = ((value >>> 6) & 0x1f) | 0xc0;
            }
            else if ((value & 0xffff0000) === 0) { // 3-byte
                target[at++] = ((value >>> 12) & 0x0f) | 0xe0;
                target[at++] = ((value >>> 6) & 0x3f) | 0x80;
            }
            else if ((value & 0xffe00000) === 0) { // 4-byte
                target[at++] = ((value >>> 18) & 0x07) | 0xf0;
                target[at++] = ((value >>> 12) & 0x3f) | 0x80;
                target[at++] = ((value >>> 6) & 0x3f) | 0x80;
            }
            else {
                continue; // out of range
            }
            target[at++] = (value & 0x3f) | 0x80;
        }
        return target.slice ? target.slice(0, at) : target.subarray(0, at);
    };
    return SekiroClient;
}());
exports["default"] = SekiroClient;
