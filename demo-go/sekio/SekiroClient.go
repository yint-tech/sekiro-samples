package sekio

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"log"
	"net"
	"time"
)

type (
	SekiroResponse interface {
		Success(data interface{})
		Fail(errorMsg string)
	}

	RequestHandler interface {
		handleRequest(request map[string]interface{}, response SekiroResponse)
	}
)

type SekiroClient struct {
	sekiroGroup string
	server      string
	ClientId    string

	handlers map[string]*RequestHandler
	running  bool
}

func (client *SekiroClient) RegisterHandler(action string, handler *RequestHandler) *SekiroClient {
	client.handlers[action] = handler
	return client
}

func (client *SekiroClient) Start() {
	if client.running {
		return
	}
	client.running = true
	go client.startSync()
}

func MakeClientDefault(group string) *SekiroClient {
	return MakeClient(group, "", "")
}

func MakeClient(group string, server string, clientId string) *SekiroClient {
	if group == "" {
		log.Printf("please setup group param")
		return nil
	}

	if server == "" {
		server = "sekiro.iinti.cn:5612"
	}
	if clientId == "" {
		newUUID, _ := uuid.NewUUID()
		clientId = newUUID.String()
	}
	print(`       welcome to use sekiro framework
for more support please visit our website: https://iinti.cn
`)
	return &SekiroClient{
		ClientId:    clientId,
		sekiroGroup: group,
		server:      server,
		handlers:    map[string]*RequestHandler{},
	}
}

func (client *SekiroClient) startSync() {
	for client.running {
		client.runLoop()
		// loop退出代表网络断开，所以5s后重新连接
		if client.running {
			time.Sleep(time.Second * 5)
		}
	}
}

func readSekiroPacket(conn net.Conn) (*SekiroPacket, error) {
	magic := int64(0)
	err := binary.Read(conn, binary.BigEndian, &magic)
	if err != nil {
		log.Printf("eof %v", err)
		return nil, err
	}
	if magic != MAGIC {
		msg := fmt.Sprintf("error magic expected:%d actully:%d", MAGIC, magic)
		return nil, errors.New(msg)
	}
	bodyLength := int32(0)
	err = binary.Read(conn, binary.BigEndian, &bodyLength)
	if err != nil {
		return nil, err
	}
	body := make([]byte, bodyLength)
	err = binary.Read(conn, binary.BigEndian, body)
	if err != nil {
		return nil, err
	}
	return decode(body)
}

func (client *SekiroClient) onSekiroPacket(conn net.Conn, packet *SekiroPacket) {
	if packet.MessageType == TypeHeartbeat {
		_, _ = conn.Write(packet.encode())
		return
	}
	if packet.MessageType != STypeInvoke {
		log.Printf("unknown server msg type: %d", packet.MessageType)
		return
	}

	sekiroResponse := SekiroResponseImpl{
		conn:    conn,
		seq:     packet.seq,
		respond: false,
	}

	if packet.Data == nil {
		sekiroResponse.Fail("sekiro system error, no request payload present!!")
		return
	}
	log.Printf("sekiro receive request:%s", string(packet.Data))
	request := make(map[string]interface{})
	_ = json.Unmarshal(packet.Data, &request)

	action := request["action"]
	if action == nil {
		sekiroResponse.Fail("the param: {action} not presented!!")
		return
	}

	handler := client.handlers[fmt.Sprintf("%v", action)]
	if handler == nil {
		sekiroResponse.Fail("sekiro no handler for this action")
		return
	}
	var response SekiroResponse = &sekiroResponse
	go (*handler).handleRequest(request, response)
}

func (client *SekiroClient) runLoop() {
	log.Printf("begin connect to: %s with clientId:%s", client.server, client.ClientId)
	conn, err := net.Dial("tcp", client.server)
	if err != nil {
		log.Printf("dia error %v", err)
		return
	}

	// write register cmd
	sekiroPacket := SekiroPacket{
		seq:         -1,
		MessageType: CTypeRegister,
		Headers:     make(map[string]string),
	}
	sekiroPacket.Headers["SEKIRO_GROUP"] = client.sekiroGroup
	sekiroPacket.Headers["SEKIRO_CLIENT_ID"] = client.ClientId
	data := sekiroPacket.encode()
	_, err1 := conn.Write(data)
	if err != nil {
		log.Printf("write register cmd error %v", err1)
		return
	}

	// begin loop
	for true {
		packet, err := readSekiroPacket(conn)
		if err != nil {
			log.Printf("read sekiro packet error %v", err)
			_ = conn.Close()
			break
		}
		client.onSekiroPacket(conn, packet)
	}
}
