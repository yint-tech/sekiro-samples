
using System;
using System.Buffers.Binary;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace SekiroClientDotnet
{
    /// <summary>
    /// 
    /// </summary>
    public class SekiroClient
    {
        /// <summary>
        /// 服务器地址
        /// </summary>
        string serverHost { get; set; }

        /// <summary>
        /// 端口号
        /// </summary>
        int serverPort { get; set; }

        /// <summary>
        /// 分组名
        /// </summary>
        string groupName { get; set; }

        /// <summary>
        /// 客户端Id（不填则自动生成）
        /// </summary>
        string clientId { get; set; }


        public SekiroClient(string host, int port, string groupName, string clientId = "")
        {
            this.serverHost = host;
            this.serverPort = port;
            this.groupName = groupName;
            this.clientId = !string.IsNullOrEmpty(clientId) ? clientId : Guid.NewGuid().ToString();
            Console.WriteLine($"SekiroClient init finish,clientId:{this.clientId}");
        }

        /// <summary>
        /// 启动Client
        /// </summary>

        public async Task Start()
        {
            // Create TCP client and connect
            // Then get the netStream and pass it
            // To our StreamWriter and StreamReader
            using (var client = new TcpClient(this.serverHost, this.serverPort))
            using (var netStream = client.GetStream())
            {
                await SendRegToServer(netStream);
                while (netStream.CanRead)
                {
                    string magicMsg = await ReadMagicMsg(netStream);
                    if (magicMsg != SekiroConstant.Magic)
                    {
                        // todo Exit()
                        continue;
                    }
                    int totalLength = await ReadTotalLength(netStream);
                    byte[] packetBuffer = await ReadPacketBuffer(netStream, totalLength);
                    var sekiroPacket = SekiroPacket.ToSekiroPacket(packetBuffer, totalLength);
                    Console.WriteLine($"rev message, seq :{sekiroPacket.Seq},type:{sekiroPacket.MessageType}");
                    if (sekiroPacket.MessageType == MessageTypes.Heartbeat)
                    {
                        await ReportHeartbeatMsg(netStream, sekiroPacket);
                    }
                    else
                    {
                        var replyMsg = new SekiroPacket(MessageTypes.SendToServer, sekiroPacket.Seq);
                        //replyMsg.Headers.Add("PAYLOAD_CONTENT_TYPE", "CONTENT_TYPE_SEKIRO_FAST_JSON");
                        replyMsg.Headers.Add("PAYLOAD_CONTENT_TYPE", "PAYLOAD_CONTENT_TYPE");
                        replyMsg.Headers.Add("SEKIRO_GROUP", this.groupName);
                        replyMsg.Headers.Add("SEKIRO_CLIENT_ID", this.clientId);
                        // replyMsg.Headers.Add("contentType", "application/json");
                        //var respBody = new { code = 0, message = "response from dotnet core", data = new{ }  };
                        replyMsg.Headers.Add("contentType", "application/text");
                        var respText = "response from dotnet core";
                        replyMsg.Data = System.Text.Encoding.UTF8.GetBytes(respText);
                        var respBuffer = replyMsg.ToBuffer();
                        var repText = replyMsg.ToHexStrFromByte();
                        await netStream.WriteAsync(respBuffer, 0, respBuffer.Length);
                        Console.WriteLine($"send seq :{sekiroPacket.Seq} response successfully.");
                    }
                }
            }
        }


        /// <summary>
        /// 上报心跳数据包
        /// </summary>
        private static async Task ReportHeartbeatMsg(NetworkStream netStream, SekiroPacket sekiroPacket)
        {
            var heartbeatBuffer = sekiroPacket.ToBuffer();
            await netStream.WriteAsync(heartbeatBuffer, 0, heartbeatBuffer.Length);
        }

        /// <summary>
        /// 上报注册数据包
        /// </summary>
        private async Task SendRegToServer(NetworkStream netStream)
        {
            var buffer = SekiroPacket.GetRegPacketBuffer(this.groupName, this.clientId);
            await netStream.WriteAsync(buffer, 0, buffer.Length);
            Console.WriteLine("send reg packet successfully.");
        }

        /// <summary>
        /// 读取PacketBuffer 信息
        /// </summary>
        private static async Task<byte[]> ReadPacketBuffer(NetworkStream netStream, int totalLength)
        {
            byte[] packetBuffer = new byte[totalLength];
            await netStream.ReadAsync(packetBuffer, 0, packetBuffer.Length);
            return packetBuffer;
        }

        /// <summary>
        /// 读取魔法Msg
        /// </summary>
        private static async Task<string> ReadMagicMsg(NetworkStream netStream)
        {
            byte[] magicBuffer = new byte[8];
            var numberOfBytesRead = await netStream.ReadAsync(magicBuffer, 0, magicBuffer.Length);
            var magicMsg = Encoding.UTF8.GetString(magicBuffer, 0, numberOfBytesRead);
            return magicMsg;
        }

        /// <summary>
        /// 读取 Packet 数据长度
        /// </summary>
        private static async Task<int> ReadTotalLength(NetworkStream netStream)
        {
            byte[] body_length_buffer = new byte[4];
            await netStream.ReadAsync(body_length_buffer, 0, body_length_buffer.Length);
            // 转大端
            if (BitConverter.IsLittleEndian) Array.Reverse(body_length_buffer);
            var body_length = BitConverter.ToInt32(body_length_buffer);
            return body_length;
        }
    }
}

