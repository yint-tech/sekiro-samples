
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Linq;

namespace SekiroClientDotnet
{
    /// <summary>
    /// Sekiro数据包
    /// 可考察 https://sekiro.iinti.cn/sekiro-doc/03_developer/1.protocol.html
    /// </summary>
    public class SekiroPacket
    {
        /// <summary>
        /// 消息类型
        /// </summary>
        public byte MessageType { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public int Seq { get; set; } = -1;

        /// <summary>
        /// 
        /// </summary>
        public byte[] Data { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();

        public SekiroPacket()
        {

        }

        public SekiroPacket(byte msgType, int seq)
        {
            this.MessageType = msgType;
            this.Seq = seq;
        }

        /// <summary>
        /// 转换成Bytes流
        /// </summary>
        public byte[] ToBuffer()
        {
            var buffer = new List<byte>();
            buffer.AddRange(System.Text.Encoding.UTF8.GetBytes(SekiroConstant.Magic));
            var encode_headers = new List<byte[]>();
            var body_length = 1 + 4 + 1;
            foreach (var item in this.Headers)
            {
                body_length += 2;
                var k_data = System.Text.Encoding.UTF8.GetBytes(item.Key);
                var v_data = System.Text.Encoding.UTF8.GetBytes(item.Value);
                encode_headers.Add(k_data);
                encode_headers.Add(v_data);
                body_length += k_data.Length;
                body_length += v_data.Length;
            }
            if (this.Data != null && this.Data.Length > 0)
            {
                body_length += Data.Length;
            }
            // 处理大小端
            var bodyLenBytes = BitConverter.GetBytes(body_length);
            if (BitConverter.IsLittleEndian)
            {
                buffer.AddRange(bodyLenBytes.Reverse());
            }
            else
            {
                buffer.AddRange(bodyLenBytes);
            }
            buffer.Add(this.MessageType);
            // 处理大小端
            var seqBytes = BitConverter.GetBytes(this.Seq);
            if (BitConverter.IsLittleEndian)
            {
                buffer.AddRange(seqBytes.Reverse());
            }
            else
            {
                buffer.AddRange(seqBytes);
            }
            buffer.Add((byte)this.Headers.Count);
            foreach (var item in encode_headers)
            {
                buffer.Add((byte)item.Length);
                buffer.AddRange(item);
            }
            if (this.Data != null)
            {
                buffer.AddRange(this.Data);
            }
            return buffer.ToArray();
        }


        /// <summary>
        /// 
        /// </summary>
        public string ToHexStrFromByte()
        {
            byte[] byteData = ToBuffer();
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < byteData.Length; i++)
            {
                builder.Append(string.Format("{0:x2} ", byteData[i]));
            }
            return builder.ToString().Trim().Replace(" ", "");
        }

        /// <summary>
        /// 注册数据包
        /// </summary>
        public static byte[] GetRegPacketBuffer(string groupName, string clientId)
        {
            var regPacket = new SekiroPacket();
            regPacket.Seq = -1;
            regPacket.Headers.Add("SEKIRO_GROUP", groupName);
            regPacket.Headers.Add("SEKIRO_CLIENT_ID", clientId);
            regPacket.Seq = -1;
            regPacket.MessageType = MessageTypes.RegGroup;
            return regPacket.ToBuffer();
        }

        /// <summary>
        /// Bytes 解数据包
        /// </summary>
        public static SekiroPacket ToSekiroPacket(byte[] buffer, int bufferLen)
        {
            SekiroPacket sekiroPacket = new SekiroPacket();
            using (var stream = new MemoryStream(buffer))
            {
                sekiroPacket.MessageType = ReadMsgType(stream);
                if (sekiroPacket.MessageType == MessageTypes.Heartbeat)
                {
                    return sekiroPacket;
                }
                sekiroPacket.Seq = ReadSeq(stream);
                int HeadersSize = ReadHeadsSize(stream);
                if (HeadersSize > 0)
                {
                    // ToDo read header
                }
                var bodyLen = bufferLen - SekiroConstant.TotalLen - SekiroConstant.MsgTypeLen - SekiroConstant.SeqIdLen - SekiroConstant.HeaderSizeLen - HeadersSize;
                var bodyBuffer = new byte[bodyLen];
                stream.Read(bodyBuffer, 0, bodyBuffer.Length);
                sekiroPacket.Data = bodyBuffer;
                // var bodyText = System.Text.Encoding.UTF8.GetString(bodyBuffer);
                // Console.WriteLine(bodyText);
            }
            return sekiroPacket;
        }


        /// <summary>
        /// 读取Headers长度
        /// </summary>
        private static int ReadHeadsSize(MemoryStream stream)
        {
            var headersSize = new byte[SekiroConstant.HeaderSizeLen];
            stream.Read(headersSize, 0, headersSize.Length);
            var HeadersSize = (int)(headersSize[0]);
            return HeadersSize;
        }

        /// <summary>
        /// 读取 Seq 流水号Id
        /// </summary>
        private static int ReadSeq(MemoryStream stream)
        {
            var seqIdBuffer = new byte[SekiroConstant.SeqIdLen];
            stream.Read(seqIdBuffer, 0, seqIdBuffer.Length);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(seqIdBuffer);
            }
            return BitConverter.ToInt32(seqIdBuffer);


        }

        /// <summary>
        /// 读取消息类型
        /// </summary>
        private static byte ReadMsgType(MemoryStream stream)
        {
            byte[] typeBuffer = new byte[SekiroConstant.MsgTypeLen];
            stream.Read(typeBuffer, 0, SekiroConstant.MsgTypeLen);
            return typeBuffer[0];
        }
    }


    /// <summary>
    /// 消息类型
    /// - 0x00 心跳包数据包
    /// - 0x10 客户端向服务端注册 group 数据包
    /// - 0x11 客户端向服务端响应数据包
    /// - 0x20 服务端调用客户端数据包
    /// </summary>
    public static class MessageTypes
    {
        public static byte Heartbeat = 0x00;

        public static byte RegGroup = 0x10;

        public static byte SendToServer = 0x11;

        public static byte RevFromServer = 0x20;
    }

    /// <summary>
    /// 常量池
    /// </summary>
    public static class SekiroConstant
    {
        /// <summary>
        /// 
        /// </summary>
        public static int MagicLen = 8;

        public static int TotalLen = 4;

        public static int MsgTypeLen = 1;

        public static int SeqIdLen = 4;

        public static int HeaderSizeLen = 1;

        /// <summary>
        /// Magic常量值
        /// </summary>
        public static string Magic = "sekiro01";
    }



}