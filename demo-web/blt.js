// ==UserScript==
// @name         blt-sekiro
// @namespace    http://tampermonkey.net/
// @version      2024-01-13
// @description  try to take over the world!
// @author       You
// @match        https://m.blt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=blt.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    function SekiroClient(e) { if (this.wsURL = e, this.handlers = {}, this.socket = {}, !e) throw new Error("wsURL can not be empty!!"); this.webSocketFactory = this.resolveWebSocketFactory(), this.connect() } SekiroClient.prototype.resolveWebSocketFactory = function () { if ("object" == typeof window) { var e = window.WebSocket ? window.WebSocket : window.MozWebSocket; return function (o) { function t(o) { this.mSocket = new e(o) } return t.prototype.close = function () { this.mSocket.close() }, t.prototype.onmessage = function (e) { this.mSocket.onmessage = e }, t.prototype.onopen = function (e) { this.mSocket.onopen = e }, t.prototype.onclose = function (e) { this.mSocket.onclose = e }, t.prototype.send = function (e) { this.mSocket.send(e) }, new t(o) } } if ("object" == typeof weex) try { console.log("test webSocket for weex"); var o = weex.requireModule("webSocket"); return console.log("find webSocket for weex:" + o), function (e) { try { o.close() } catch (e) { } return o.WebSocket(e, ""), o } } catch (e) { console.log(e) } if ("object" == typeof WebSocket) return function (o) { return new e(o) }; throw new Error("the js environment do not support websocket") }, SekiroClient.prototype.connect = function () { console.log("sekiro: begin of connect to wsURL: " + this.wsURL); var e = this; try { this.socket = this.webSocketFactory(this.wsURL) } catch (o) { return console.log("sekiro: create connection failed,reconnect after 2s:" + o), void setTimeout(function () { e.connect() }, 2e3) } this.socket.onmessage(function (o) { e.handleSekiroRequest(o.data) }), this.socket.onopen(function (e) { console.log("sekiro: open a sekiro client connection") }), this.socket.onclose(function (o) { console.log("sekiro: disconnected ,reconnection after 2s"), setTimeout(function () { e.connect() }, 2e3) }) }, SekiroClient.prototype.handleSekiroRequest = function (e) { console.log("receive sekiro request: " + e); var o = JSON.parse(e), t = o.__sekiro_seq__; if (o.action) { var n = o.action; if (this.handlers[n]) { var s = this.handlers[n], i = this; try { s(o, function (e) { try { i.sendSuccess(t, e) } catch (e) { i.sendFailed(t, "e:" + e) } }, function (e) { i.sendFailed(t, e) }) } catch (e) { console.log("error: " + e), i.sendFailed(t, ":" + e) } } else this.sendFailed(t, "no action handler: " + n + " defined") } else this.sendFailed(t, "need request param {action}") }, SekiroClient.prototype.sendSuccess = function (e, o) { var t; if ("string" == typeof o) try { t = JSON.parse(o) } catch (e) { (t = {}).data = o } else "object" == typeof o ? t = o : (t = {}).data = o; (Array.isArray(t) || "string" == typeof t) && (t = { data: t, code: 0 }), t.code ? t.code = 0 : (t.status, t.status = 0), t.__sekiro_seq__ = e; var n = JSON.stringify(t); console.log("response :" + n), this.socket.send(n) }, SekiroClient.prototype.sendFailed = function (e, o) { "string" != typeof o && (o = JSON.stringify(o)); var t = {}; t.message = o, t.status = -1, t.__sekiro_seq__ = e; var n = JSON.stringify(t); console.log("sekiro: response :" + n), this.socket.send(n) }, SekiroClient.prototype.registerAction = function (e, o) { if ("string" != typeof e) throw new Error("an action must be string"); if ("function" != typeof o) throw new Error("a handler must be function"); return console.log("sekiro: register action: " + e), this.handlers[e] = o, this };

    const pathSegments = document.location.href.split('/');

    let city_id = "unknown";
    if (pathSegments.length >= 3) {
        city_id = pathSegments[3];
    }

    var client = new SekiroClient("wss://sekiro.iinti.cn/business/register?group=blt-house&clientId=sh_nx_windows_10_" + city_id);
    client.registerAction("scollTo", function (request, resolve, reject) {
        scrollTo(0, parseInt(request.yCoord));
        resolve(`scrollTo to ${request.yCoord} ok`);
    });

    client.registerAction("reloadPage", function (request, resolve, reject) {
        window.location.reload();
        resolve(`refreshWindows ok`);
    });

    client.registerAction("openPage", function (request, resolve, reject) {
        window.location.href = request.url;
        resolve(`openUrl ${request.url} ok`);
    });
    
    client.registerAction("loadHouses", function (request, resolve, reject) {

        // 获取所有包含房屋信息的div元素  
        const houseInfoDivs = Array.from(document.querySelectorAll('.house-card'));
        // 创建一个数组来存储所有房屋信息  
        const allHouseInfo = [];

        // 遍历每个包含房屋信息的div元素，提取信息并存储到数组中  
        houseInfoDivs.forEach(houseInfoDiv => {
            const title = houseInfoDiv.querySelector('.title span').textContent;
            const imageStyle = houseInfoDiv.querySelector('.main-image').style.backgroundImage;
            const imageUrlMatch = imageStyle.match(/url\("([^"]+)"\)/);
            const imageUrl = imageUrlMatch ? imageUrlMatch[1] : "";
            const parts = imageUrl.split('/');
            const houseId = parts[parts.length - 2];
            const roomInfo = houseInfoDiv.querySelector('.room-info').textContent;
            const labels = Array.from(houseInfoDiv.querySelectorAll('.labels .label')).map(label => label.textContent);
            const price = houseInfoDiv.querySelector('.price .bold').textContent;
            const locationInfo = houseInfoDiv.querySelector('.trafic .text').textContent;

            const houseObject = {
                title: title,
                image: imageUrl.replace("@!330_260", "").replace("@!330_220", ""),
                roomInfo: roomInfo,
                labels: labels,
                price: price,
                location: locationInfo,
                houseId: houseId
            };

            allHouseInfo.push(houseObject);
        });
        const resp = {
            city_id,
            allHouseInfo
        }
        resolve(resp);
    });
})();