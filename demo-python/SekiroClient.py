# Python版本的Sekiro的client
import datetime
import json
from uuid import uuid4

from tornado import ioloop, gen, iostream
from tornado.tcpclient import TCPClient

_MAGIC = 0x73656b69726f3031  # sekiro01


class _SekiroPacket:
    def __init__(self):
        self.message_type = -1
        self.seq = -1
        self.data = None
        self.headers = {}

    def add_header(self, key: str, value: str):
        self.headers[key] = value

    def read_from(self, body_data: bytes):
        index = 0
        self.message_type = _bytes_to_int(body_data[index:index + 1])
        index += 1

        self.seq = _bytes_to_int(body_data[index:index + 4])
        index += 4

        header_size = _bytes_to_int(body_data[index:index + 1])
        index += 1

        for i in range(header_size):
            key_len = _bytes_to_int(body_data[index:index + 1])
            index += 1
            key = body_data[index:index + key_len].decode("utf-8")
            index += key_len

            value_len = _bytes_to_int(body_data[index:index + 1])
            index += 1
            value = body_data[index:index + value_len].decode("utf-8")
            index += value_len
            self.add_header(key, value)
        if index < len(body_data):
            self.data = body_data[index:]

    def write_to(self, stream: iostream):
        encode_headers = []
        body_length = 1 + 4 + 1
        for k, v in self.headers.items():
            body_length += 2
            k_data = k.encode("utf-8")
            v_data = v.encode("utf-8")
            encode_headers.append(k_data)
            encode_headers.append(v_data)
            body_length += len(k_data)
            body_length += len(v_data)
        if self.data is not None:
            body_length += len(self.data)
        stream.write(_MAGIC.to_bytes(length=8, byteorder="big", signed=True))
        stream.write(body_length.to_bytes(length=4, byteorder="big", signed=True))
        stream.write(self.message_type.to_bytes(length=1, byteorder="big", signed=True))
        stream.write(self.seq.to_bytes(length=4, byteorder="big", signed=True))
        stream.write((len(self.headers)).to_bytes(length=1, byteorder="big"))
        for h in encode_headers:
            stream.write(len(h).to_bytes(length=1, byteorder="big"))
            stream.write(h)
        if self.data is not None:
            stream.write(self.data)


def _bytes_to_int(bytes_data):
    return int().from_bytes(bytes_data, byteorder='big', signed=True)


class _CommonRes:
    def __init__(self):
        self.data = None
        self.message = ""
        self.status = None

    def ok(self, data):
        self.status = 0
        self.message = ""
        self.data = data
        return self

    def failed(self, message: str):
        self.status = -1
        self.message = message
        self.data = None
        return self


def _encode_sekiro_fast_json(common_res: _CommonRes) -> bytes:
    msg_part = common_res.message.encode("utf-8") if common_res.message is not None else None
    msg_part_len = (len(msg_part) if msg_part is not None else 0)

    json_part = json.dumps(common_res.data, ensure_ascii=False).encode("utf-8") if common_res.data is not None else None
    json_part_len = len(json_part) if json_part is not None else 0

    result = common_res.status.to_bytes(length=4, byteorder="big", signed=True) + msg_part_len.to_bytes(length=4,
                                                                                                        byteorder="big")
    if msg_part_len > 0:
        result += msg_part
    result += json_part_len.to_bytes(length=4, byteorder="big")
    if json_part_len > 0:
        result += json_part

    return result


class SekiroResponse:
    def __init__(self, stream: iostream, seq: int):
        self._stream = stream
        self._respond = False
        self._seq = seq

    def success(self, data):
        """
        请注意，data必须可以被json序列化，如果是复合对象，你需要自行转换成dict、list等基础结构，垃圾python
        """
        self._response(_CommonRes().ok(data))

    def failed(self, message: str):
        self._response(_CommonRes().failed(message))

    def _response(self, common_res: _CommonRes):
        if self._respond:
            return
        self._respond = True
        response_pkg = _SekiroPacket()
        response_pkg.seq = self._seq
        response_pkg.message_type = 0x11
        response_pkg.add_header("PAYLOAD_CONTENT_TYPE", "CONTENT_TYPE_SEKIRO_FAST_JSON")
        response_pkg.data = _encode_sekiro_fast_json(common_res)
        response_pkg.write_to(self._stream)
        message = "{\"status\":" + str(common_res.status) + ",\"message\":" + json.dumps(
            common_res.message, ensure_ascii=False) + ",\"data\":" + json.dumps(common_res.data,
                                                                                ensure_ascii=False) + "}"

        print("sekiro response: ", message)


class SekiroHandler:
    """
    the user handlr
    """

    def handle(self, request: json, response: SekiroResponse):
        pass


class SekiroClient:
    def __init__(self, group, host="sekiro.iinti.cn", port=5612, client_id=None):
        self._group = group
        self._host = host
        self._port = port
        self._client_id = client_id if client_id is not None else str(uuid4())
        self._handlers = {}
        self._started = False
        print("""       welcome to use sekiro framework
for more support please visit our website: https://iinti.cn""")

    def _make_register_pkg(self) -> _SekiroPacket:
        register_cmd = _SekiroPacket()
        register_cmd.message_type = 0x10
        register_cmd.seq = -1
        register_cmd.add_header("SEKIRO_GROUP", self._group)
        register_cmd.add_header("SEKIRO_CLIENT_ID", self._client_id)
        return register_cmd

    def _get_handler(self, action: str) -> SekiroHandler:
        return self._handlers.get(action)

    def register_action(self, action: str, sekiro_handler: SekiroHandler):
        self._handlers[action] = sekiro_handler

    def run_sync(self):
        ioloop.IOLoop.current().run_sync(self.__loop)

    @gen.coroutine
    def __loop(self):
        if self._started:
            return
        self._started = True
        print("begin connect to " + self._host + ":" + str(self._port))
        stream = yield TCPClient().connect(self._host, self._port)
        try:
            # write a register cmd to sekiro server
            self._make_register_pkg().write_to(stream)
            while True:
                magic_b = yield stream.read_bytes(8)
                magic = _bytes_to_int(magic_b)
                if magic != _MAGIC:
                    print("protocol error,magic1 expected:%d actually: %d", _MAGIC, magic)
                    stream.close()
                    break
                body_length_b = yield stream.read_bytes(4)
                body_length = _bytes_to_int(body_length_b)

                body_data = yield stream.read_bytes(body_length)

                sekiro_packet = _SekiroPacket()
                sekiro_packet.read_from(body_data)
                self._on_packet_read(sekiro_packet, stream)
        except iostream.StreamClosedError:
            print("connection lost, prepare reconnect")

        self._started = False
        ioloop.IOLoop.current().call_later(3, self.__loop)

    def _on_packet_read(self, sekiro_packet: _SekiroPacket, stream: iostream):
        if sekiro_packet.message_type == 0x00:
            # this is heartbeat pkg
            sekiro_packet.write_to(stream)
            return
        if sekiro_packet.message_type != 0x20:
            print("unknown server msg:%d", sekiro_packet.message_type)
            return
        sekiro_response = SekiroResponse(stream, sekiro_packet.seq)
        if sekiro_packet.data is None:
            sekiro_response.failed("sekiro system error, no request payload present!!")
            return
        request_str = sekiro_packet.data.decode("utf-8")
        print("sekiro receive request: ", request_str)
        request = json.loads(request_str)
        action = request["action"]
        if action is None:
            sekiro_response.failed("the param: {action} not presented!!")
            return
        handler = self._get_handler(action)
        if handler is None:
            sekiro_response.failed("sekiro no handler for this action")
            return
        try:
            handler.handle(request, sekiro_response)
        except Exception as e:
            print("Error", e)
            sekiro_response.failed("failed: " + str(e))
