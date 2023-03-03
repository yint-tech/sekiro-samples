# Invoker是给客户端调用sekiro提供的高性能和使用友好的API
import asyncio
import gzip
import json
import threading

from tornado import iostream, ioloop

from sekiro.SekiroCommon import _SekiroPacket, AbsSekiroConn, _bytes_to_int


def _decode_sekiro_fast_json(data: bytes, client_id: str) -> str:
    index = 0
    status = _bytes_to_int(data[index:index + 4])
    index += 4
    length = _bytes_to_int(data[index:index + 4])
    index += 4
    msg = None
    if length > 0:
        msg = data[index:index + length].decode("utf-8")
        index += length

    length = _bytes_to_int(data[index:index + 4])
    index += 4
    json_part = None
    if length > 0:
        json_part = data[index:index + length].decode("utf-8")
        index += length
    msg = json.encoder.py_encode_basestring(msg) if msg is not None else "null"
    json_part = json_part if json_part is not None else "null"

    json_body = "{\"clientId\":" + client_id + ",\"message\":" + msg + \
                ",\"status\":" + str(status) + ",\"data\":" + json_part + "}"
    return json_body


class _Record:
    def __init__(self):
        self.condition = threading.Condition()
        self._response: dict = {
            "status": -1,
            "message": "invoker client timeout"
        }

    def wait(self, timeout=20) -> dict:
        self.condition.acquire()
        self.condition.wait(timeout)
        self.condition.release()
        return self._response

    @staticmethod
    def decode_sekiro_packet(pkg: _SekiroPacket) -> dict:
        # 如果数据有压缩，那么需要在端上解压
        compress_method = pkg.headers.get('COMPRESS_METHOD')
        if compress_method is not None and compress_method != 'COMPRESS_METHOD_NONE':
            if compress_method != 'COMPRESS_METHOD_GZIP':
                # 当前sekiro只支持标准的gzip压缩算法的解压，当然目前只有java端的对端支持了压缩，
                # 即当前只有python的invoker调用xposed的SekiroClient会默认走到压缩
                # 压缩行为的判定在SekiroClient，他通过报文大小来决定是否启动压缩，以及通过用户的主动控制来确定是否压缩
                return {
                    "status": -1,
                    "message": "invoker client error, the python client just only support gzip compress method ,"
                               "now is: " + compress_method
                }
            pkg.data = gzip.decompress(pkg.data)
        # 大部分情况下，数据格式是sekiro-fast-json格式，此格式专门用于给服务端支持状态监控使用
        content_type = pkg.headers.get('PAYLOAD_CONTENT_TYPE')
        content_type = content_type if content_type is not None else pkg.headers.get('Content-Type')
        if content_type is None:
            return {
                "status": 0,
                "data": pkg.data
            }
        sekiro_client_id = pkg.headers.get('SEKIRO_CLIENT_ID')
        if content_type == 'CONTENT_TYPE_SEKIRO_FAST_JSON':
            body = _decode_sekiro_fast_json(pkg.data, sekiro_client_id if sekiro_client_id is not None else 'null')
        elif str(content_type).lower().startswith('application/json;'):
            body = pkg.data.decode("utf-8")
        else:
            return {
                "status": 0,
                "data": pkg.data
            }
        return json.loads(body)

    def response(self, res):
        if isinstance(res, str):
            self._response = {
                "status": -1,
                "message": res
            }
        elif isinstance(res, _SekiroPacket):
            self._response = self.decode_sekiro_packet(res)
        else:
            self._response = {
                "status": -1,
                "message": "unknown response msg type:" + str(type(res))
            }
        self.condition.acquire()
        self.condition.notify_all()
        self.condition.release()


class _InvokerConn(AbsSekiroConn):
    def __init__(self, api_token: str, host: str, port: int, condition: threading.Condition):
        super().__init__(host, port)
        self._api_token = api_token
        self._seq = 0
        self._start_wait_condition = condition
        self.running_request = {}

    def make_register_pkg(self) -> _SekiroPacket:
        # reset seq when reconnect to sekiro server
        self._seq = 0
        for key in self.running_request.keys():
            record: _Record = self.running_request.pop(key)
            record.response("lost connection to sekiro server node")
            
        self._start_wait_condition.acquire()
        self._start_wait_condition.notify_all()
        self._start_wait_condition.release()

        register_cmd = _SekiroPacket()
        register_cmd.message_type = 0x30
        register_cmd.seq = -1
        return register_cmd

    def handle_packet(self, sekiro_packet: _SekiroPacket, stream: iostream):
        if sekiro_packet.message_type == 0x24:
            print("connect to sekiro server success")
            return
        if sekiro_packet.message_type != 0x11 and sekiro_packet.message_type != 0x23:
            print("unknown server msg: " + str(sekiro_packet.message_type))
            return
        record = self.running_request[sekiro_packet.seq]
        if record is None:
            print("no invoke record for: %d", sekiro_packet.seq)
            return
        record.response(sekiro_packet)

    def request(self, group, action, **kwargs) -> dict:
        seq = self._seq
        self._seq += 1

        sekiro_packet = _SekiroPacket()
        sekiro_packet.message_type = 0x31
        sekiro_packet.seq = seq

        request_body = dict(**kwargs)
        request_body['group'] = group
        request_body['action'] = action

        if self._api_token:
            request_body['sekiro_token'] = self._api_token
        sekiro_packet.data = json.dumps(request_body, ensure_ascii=False).encode("utf-8")

        self.io_loop.call_later(0, lambda: sekiro_packet.write_to(self.now_stream))

        # 注册回调
        record = _Record()
        self.running_request[seq] = record

        wait_time = 20
        config = kwargs.get('invoke_timeout')
        if config is not None:
            wait_time = int(config)

        ret = record.wait(wait_time)
        if self.running_request[seq]:
            del self.running_request[seq]
        return ret


class SekiroInvoker:
    def __init__(self, api_token="", server_list=None):
        if server_list is None:
            server_list = ["sekiro.iinti.cn:5612"]
        self.conns = []
        self.index = 0
        self.condition = threading.Condition()
        for server in server_list:
            segments = server.split(":")
            self.conns.append(_InvokerConn(api_token, segments[0], int(segments[1]), self.condition))
        threading.Thread(target=self.__do_start).start()
        print("""       welcome to use sekiro framework
                for more support please visit our website: https://iinti.cn""")
        self.condition.acquire()
        self.condition.wait(30)
        self.condition.release()

        for conn in self.conns:
            if conn.is_active():
                return
        raise "connect to sekiro server node timeout"

    def __do_start(self):
        event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(event_loop)

        for con in self.conns:
            ioloop.IOLoop.instance().add_callback(con.loop)

        ioloop.IOLoop.instance().start()

    def request(self, group, action, **kwargs):
        """ 调用sekiro服务，将会选择某个存活的skeiro服务器进行调用转发 """
        if len(self.conns) == 1:
            return self.conns[0].request(group, action, **kwargs)
        slot = self.index
        self.index += 1
        for i in range(len(self.conns)):
            candidate = self.conns[(slot + i) % len(self.conns)]
            if candidate.is_active():
                return candidate.request(group, action, **kwargs)
        raise Exception("no available sekiro server node")
