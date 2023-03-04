
using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace SekiroClientDotnet
{
    /// <summary>
    /// SekiroClient 扩展相关函数
    /// </summary>
    public partial class SekiroClient
    {
        
        private static async Task CheckMagicMsg()
        {
            string magicMsg = await ReadMagicMsg(netStream);
            if (magicMsg != SekiroConstant.Magic)
            {
                throw new Exception($"rev magicMsg fail,restart it, magicMsg:{magicMsg}");
            }
        }

        private static async Task<SekiroPacket> ReadPacket()
        {
            int totalLength = await ReadTotalLength(netStream);
            byte[] packetBuffer = await ReadPacketBuffer(netStream, totalLength);
            var sekiroPacket = SekiroPacket.ToSekiroPacket(packetBuffer, totalLength);
            Console.WriteLine($"rev message, seq :{sekiroPacket.Seq},type:{sekiroPacket.MessageType}");
            return sekiroPacket;
        }


        /// <summary>
        /// 上报心跳数据包
        /// </summary>
        private static async Task ReportHeartbeatMsg(NetworkStream netStream, SekiroPacket sekiroPacket)
        {
            var heartbeatBuffer = sekiroPacket.ToBuffer();
            await netStream.WriteAsync(heartbeatBuffer, 0, heartbeatBuffer.Length);
            Console.WriteLine("reply heartbeat successfully.");

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

