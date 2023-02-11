package sekio

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"log"
	"net"
)

type SekiroPacket struct {
	MessageType byte              // 消息类型
	seq         int32             // 流水号
	Headers     map[string]string // headers
	Data        []byte            // 核心数据
}

const (
	TypeHeartbeat          = 0x00
	CTypeRegister          = 0x10
	CTypeInvokeResponse    = 0x11
	CTypeOffline           = 0x12
	CTypeCmdResponse       = 0x13
	CTypeInvokeStreamClose = 0x14
	STypeInvoke            = 0x20
	STypeCmd               = 0x21
	STypeOfflineResponse   = 0x22
	STypeInvokeResponse    = 0x23
	STypeInvokeConnected   = 0x24
	ITypeConnect           = 0x30
	ITypeInvoke            = 0x31

	MAGIC = int64(0x73656b69726f3031)
)

func (sekiroPacket *SekiroPacket) encode() []byte {
	bodyLength := int32(6)
	headerByteArray := make([][]byte, 0, len(sekiroPacket.Headers))
	for key, value := range sekiroPacket.Headers {
		keyBytes := []byte(key)
		valueByte := []byte(value)
		bodyLength += 2
		bodyLength += int32(len(keyBytes))
		bodyLength += int32(len(valueByte))

		headerByteArray = append(headerByteArray, keyBytes)
		headerByteArray = append(headerByteArray, valueByte)
	}

	if sekiroPacket.Data != nil {
		bodyLength += int32(len(sekiroPacket.Data))
	}

	buf := bytes.Buffer{}
	err := binary.Write(&buf, binary.BigEndian, MAGIC)
	err = binary.Write(&buf, binary.BigEndian, bodyLength)
	err = binary.Write(&buf, binary.BigEndian, sekiroPacket.MessageType)
	err = binary.Write(&buf, binary.BigEndian, sekiroPacket.seq)
	err = binary.Write(&buf, binary.BigEndian, int8(len(sekiroPacket.Headers)))

	for _, headerItem := range headerByteArray {
		err = binary.Write(&buf, binary.BigEndian, byte(len(headerItem)))
		err = binary.Write(&buf, binary.BigEndian, headerItem)
	}
	if dataLength := int32(len(sekiroPacket.Data)); dataLength != 0 {
		err = binary.Write(&buf, binary.BigEndian, sekiroPacket.Data)
	}

	if err != nil {
		// 这个错误不应该发生
		log.Fatal("encode error ", err)
	}
	return buf.Bytes()
}

func decode(data []byte) (*SekiroPacket, error) {
	buffer := bytes.NewBuffer(data)
	packet := &SekiroPacket{
		MessageType: 0xFF,
		seq:         -1,
		Headers:     make(map[string]string),
	}
	err := binary.Read(buffer, binary.BigEndian, &(packet.MessageType))
	err = binary.Read(buffer, binary.BigEndian, &(packet.seq))

	headerSize := int8(0)
	err = binary.Read(buffer, binary.BigEndian, &headerSize)

	var i int8
	for i = 0; i < headerSize; i++ {
		keyLength := int8(0)
		err = binary.Read(buffer, binary.BigEndian, &keyLength)

		keyPayload := make([]byte, keyLength)
		err = binary.Read(buffer, binary.BigEndian, &keyPayload)

		valueLength := int8(0)
		err = binary.Read(buffer, binary.BigEndian, &valueLength)

		valuePayLoad := make([]byte, valueLength)
		err = binary.Read(buffer, binary.BigEndian, &valuePayLoad)
		packet.Headers[string(keyPayload)] = string(valuePayLoad)
	}

	if buffer.Len() > 0 {
		packet.Data = buffer.Bytes()
	}
	if err != nil {
		return nil, err
	}
	return packet, nil
}

type commonRes struct {
	Status  int32       `json:"status"`
	Message *string     `json:"message"`
	Data    interface{} `json:"data"`
}

func (res *commonRes) encodeSekiroFastJson() []byte {
	buf := bytes.Buffer{}
	_ = binary.Write(&buf, binary.BigEndian, res.Status)
	if res.Message == nil {
		_ = binary.Write(&buf, binary.BigEndian, int32(0))
	} else {
		msgPart := []byte(*(res.Message))
		_ = binary.Write(&buf, binary.BigEndian, int32(len(msgPart)))
		_ = binary.Write(&buf, binary.BigEndian, msgPart)
	}

	if res.Data == nil {
		_ = binary.Write(&buf, binary.BigEndian, int32(0))
	} else {
		jsonPart, _ := json.Marshal(res.Data)
		_ = binary.Write(&buf, binary.BigEndian, int32(len(jsonPart)))
		_ = binary.Write(&buf, binary.BigEndian, jsonPart)
	}
	return buf.Bytes()
}

type SekiroResponseImpl struct {
	seq     int32
	conn    net.Conn
	respond bool
}

func (response *SekiroResponseImpl) Success(data interface{}) {
	response.response(commonRes{
		Data:   data,
		Status: 0,
	})
}

func (response *SekiroResponseImpl) Fail(errorMsg string) {
	response.response(commonRes{
		Message: &errorMsg,
		Status:  -1,
	})
}

func (response *SekiroResponseImpl) response(res commonRes) {
	if response.respond {
		return
	}
	response.respond = true
	packet := SekiroPacket{
		seq:         response.seq,
		MessageType: CTypeInvokeResponse,
		Headers:     make(map[string]string),
		Data:        res.encodeSekiroFastJson(),
	}
	packet.Headers["PAYLOAD_CONTENT_TYPE"] = "CONTENT_TYPE_SEKIRO_FAST_JSON"
	_, _ = response.conn.Write(packet.encode())
	body, _ := json.Marshal(res)
	log.Printf("sekiro response: %s", body)
}
