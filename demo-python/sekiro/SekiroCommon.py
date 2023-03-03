import asyncio
import threading

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


class AbsSekiroConn:
    def __init__(self, host: str, port: int):
        self._host = host
        self._port = port
        self._active = False
        self.now_stream = None
        self.io_loop: ioloop.IOLoop
        self.__started = False

    def _start_impl(self):
        if self.__started:
            return
        self.__started = True
        event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(event_loop)
        ioloop.IOLoop.instance().run_sync(self.loop)

    def start(self):
        threading.Thread(target=self._start_impl, name="sekiro-main").start()

    def is_active(self):
        return self._active

    def make_register_pkg(self) -> _SekiroPacket:
        pass

    def handle_packet(self, pkt: _SekiroPacket, stream: iostream):
        pass

    @gen.coroutine
    def loop(self):
        if self._active:
            return
        self._active = True
        self.io_loop = ioloop.IOLoop.current()
        print("begin connect to " + self._host + ":" + str(self._port))
        stream = yield TCPClient().connect(self._host, self._port)
        self.now_stream = stream
        try:
            # write a register cmd to sekiro server
            self.make_register_pkg().write_to(stream)
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
                if sekiro_packet.message_type == 0x00:
                    # this is heartbeat pkg
                    print("receive heartbeat pkg")
                    sekiro_packet.write_to(stream)
                    continue
                self.handle_packet(sekiro_packet, stream)
        except iostream.StreamClosedError:
            print("connection lost, prepare reconnect")

        self._active = False
        self.io_loop.call_later(3, self.loop)
