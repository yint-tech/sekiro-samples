var SekiroClient=function(){function e(e){this.handlers={},this.isConnecting=!1,this.sekiroOption=e,e.serverHost=e.serverHost||"sekiro.virjar.com",e.serverPort=e.serverPort||5612,this.fridaSocketConfig={family:"ipv4",host:e.serverHost,port:e.serverPort},console.log("           welcome to use sekiro framework,\n      for more support please visit our website: https://iinti.cn\n"),this.doConnect()}return e.prototype.registerAction=function(e,t){this.handlers[e]=t},e.prototype.reConnect=function(){var e=this;console.log("sekiro try connection after 5s"),setTimeout(function(){return e.doConnect()},5e3)},e.prototype.doConnect=function(){var e=this;this.isConnecting||(this.isConnecting=!0,console.log("sekiro connect to server-> "+this.fridaSocketConfig.host+":"+this.fridaSocketConfig.port),Socket.connect(this.fridaSocketConfig).then(function(t){e.isConnecting=!1,t.setNoDelay(!0),e.conn=t,e.connRead(),e.connWrite({type:16,serialNumber:-1,headers:{SEKIRO_GROUP:e.sekiroOption.sekiroGroup,SEKIRO_CLIENT_ID:e.sekiroOption.clientId}})})["catch"](function(t){e.isConnecting=!1,console.log("sekiro connect failed",t),e.reConnect()}))},e.prototype.connWrite=function(e){var t=this;this.conn.output.write(this.encodeSekiroPacket(e))["catch"](function(e){console.log("sekiro write register cmd failed",e),t.reConnect()})},e.prototype.connRead=function(){var e=this;this.conn.input.read(1024).then(function(t){return t.byteLength<=0?(e.conn.close(),console.log("sekiro server lost!"),void e.reConnect()):(e.onServerData(t),void setImmediate(function(){e.connRead()}))})["catch"](function(t){console.log("sekiro read_loop error",t),e.reConnect()})},e.prototype.onServerData=function(e){var t=this;if(this.readBuffer){if(e){var r=new ArrayBuffer(this.readBuffer.byteLength+e.byteLength),n=new Uint8Array(r);n.set(new Uint8Array(this.readBuffer),0),n.set(new Uint8Array(e),this.readBuffer.byteLength),this.readBuffer=r}}else{if(!e)return;this.readBuffer=e}var i=this.decodeSekiroPacket();i&&(this.handleServerPkg(i),setImmediate(function(){return t.onServerData()}))},e.prototype.encodeSekiroFastJSON=function(e){var t=void 0;e.msg&&(t=this.str2Uint8(e.msg));var r=void 0;e.data&&(r=this.str2Uint8(JSON.stringify(e.data)));var n=8+(t?t.length:0)+4+(r?r.length:0),i=new ArrayBuffer(n),o=new DataView(i);o.setInt32(0,e.status),o.setInt32(4,t?t.length:0);var s=8;return t&&(new Uint8Array(i,8).set(t),s+=t.length),o.setInt32(s,r?r.length:0),s+=4,r&&new Uint8Array(i,s).set(r),i},e.prototype.handleServerPkg=function(e){if(0==e.type)return void this.connWrite(e);if(32!=e.type)return void console.log("unknown server message:"+JSON.stringify(e));var t=this,r=function(r){t.connWrite({type:17,serialNumber:e.serialNumber,headers:{PAYLOAD_CONTENT_TYPE:"CONTENT_TYPE_SEKIRO_FAST_JSON"},data:t.encodeSekiroFastJSON(r)})},n=function(e){r({status:0,data:e})},i=function(e){r({status:-1,msg:e})};if(!e.data)return void i("sekiro system error, no request payload present!!");var o=this.uint8toStr(new Uint8Array(e.data));console.log("sekiro receive request: "+o);var s=JSON.parse(o);if(!s.action)return void i("the param: {action} not presented!!");var a=this.handlers[s.action];if(!a)return void i("sekiro no handler for this action");try{a(s,n,i)}catch(c){i("sekiro handler error:"+c+JSON.stringify(c))}},e.prototype.decodeSekiroPacket=function(){if(!this.readBuffer)return void 0;var e=new DataView(this.readBuffer),t=e.getInt32(0),r=e.getInt32(4);if(1936026473!=t||1919889457!=r)return console.log("sekiro packet data"),this.conn.close().then(function(){console.log("sekiro close broken pipe")}),void(this.readBuffer=void 0);var n=e.getInt32(8);if(!(this.readBuffer.byteLength<n+12)){for(var i=e.getInt8(12),o=e.getInt32(13),s=e.getInt8(17),a=18,c={},f=0;s>f;f++){var u=e.getInt8(a++),h=this.uint8toStr(new Uint8Array(this.readBuffer.slice(a,u)));a+=u;var d=e.getInt8(a++),l="";d>0&&(l=this.uint8toStr(new Uint8Array(this.readBuffer.slice(a,d))),a+=d),c[h]=l}var v=void 0,g=n+12-a;return g>0&&(v=this.readBuffer.slice(a,a+g)),this.readBuffer.byteLength==n+12?this.readBuffer=void 0:this.readBuffer=this.readBuffer.slice(a),{type:i,serialNumber:o,headers:c,data:v}}},e.prototype.encodeSekiroPacket=function(e){var t=6,r=[];for(var n in e.headers)r.push(this.str2Uint8(n)),r.push(this.str2Uint8(e.headers[n])),t+=2;t+=r.reduce(function(e,t){return e+t.length},0),e.data&&(t+=e.data.byteLength);var i=new ArrayBuffer(t+12),o=new DataView(i);o.setUint32(0,1936026473),o.setUint32(4,1919889457),o.setInt32(8,t),o.setInt8(12,e.type),o.setInt32(13,e.serialNumber),o.setInt8(17,Object.keys(e.headers).length);var s=18;return r.forEach(function(e){o.setInt8(s++,e.length),new Uint8Array(i,s).set(e),s+=e.length}),e.data&&new Uint8Array(i,s).set(new Uint8Array(e.data)),i},e.prototype.uint8toStr=function(e){for(var t,r,n=0,i=Math.min(65536,e.length+1),o=new Uint16Array(i),s=[],a=0,c=function(){var c=n<e.length;if(!c||a>=i-1){var f=o.subarray(0,a),u=[];if(f.forEach(function(e){return u.push(e)}),s.push(String.fromCharCode.apply(null,u)),!c)return{value:s.join("")};e=e.subarray(n),n=0,a=0}var h=e[n++];if(0===(128&h))o[a++]=h;else if(192===(224&h))r=63&e[n++],o[a++]=(31&h)<<6|r;else if(224===(240&h))r=63&e[n++],t=63&e[n++],o[a++]=(31&h)<<12|r<<6|t;else if(240===(248&h)){r=63&e[n++],t=63&e[n++];var d=63&e[n++],l=(7&h)<<18|r<<12|t<<6|d;l>65535&&(l-=65536,o[a++]=l>>>10&1023|55296,l=56320|1023&l),o[a++]=l}};;){var f=c();if("object"==typeof f)return f.value}},e.prototype.str2Uint8=function(e){for(var t=0,r=e.length,n=0,i=Math.max(32,r+(r>>>1)+7),o=new Uint8Array(i>>>3<<3);r>t;){var s=e.charCodeAt(t++);if(s>=55296&&56319>=s){if(r>t){var a=e.charCodeAt(t);56320===(64512&a)&&(++t,s=((1023&s)<<10)+(1023&a)+65536)}if(s>=55296&&56319>=s)continue}if(n+4>o.length){i+=8,i*=1+t/e.length*2,i=i>>>3<<3;var c=new Uint8Array(i);c.set(o),o=c}if(0!==(4294967168&s)){if(0===(4294965248&s))o[n++]=s>>>6&31|192;else if(0===(4294901760&s))o[n++]=s>>>12&15|224,o[n++]=s>>>6&63|128;else{if(0!==(4292870144&s))continue;o[n++]=s>>>18&7|240,o[n++]=s>>>12&63|128,o[n++]=s>>>6&63|128}o[n++]=63&s|128}else o[n++]=s}return o.slice?o.slice(0,n):o.subarray(0,n)},e}();