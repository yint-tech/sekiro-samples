
using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace SekiroClientDotnet
{
    /// <summary>
    /// 
    /// </summary>
    public partial class SekiroClient
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

        static NetworkStream netStream { get; set; }


        Dictionary<string, Func<JToken, Task<byte[]>>> FuncList;


        /// <summary>
        /// Client初始化
        /// </summary>
        public SekiroClient(string host, int port, string groupName, string clientId = "")
        {
            this.serverHost = host;
            this.serverPort = port;
            this.groupName = groupName;
            this.clientId = !string.IsNullOrEmpty(clientId) ? clientId : Guid.NewGuid().ToString();
            this.FuncList = new Dictionary<string, Func<JToken, Task<byte[]>>>();
            Serilog.Log.Information($"SekiroClient init finish,clientId:{this.clientId}");

        }

        /// <summary>
        /// 添加Action
        /// </summary>
        public void AddAction(string actionName, Func<JToken, Task<byte[]>> action)
        {
            this.FuncList[actionName] = action;
        }

        /// <summary>
        /// 启动Client
        /// </summary>

        public async Task Start()
        {
            while (true)
            {
                try
                {
                    // Create TCP client and connect
                    // Then get the netStream and pass it
                    // To our StreamWriter and StreamReader
                    using (var tcpClient = new TcpClient(this.serverHost, this.serverPort))
                    using (netStream = tcpClient.GetStream())
                    {
                        // 启动后发送注册包
                        await SendRegToServer(netStream);
                        while (netStream.CanRead)
                        {
                            // 检查MagicMsg
                            await CheckMagicMsg();
                            SekiroPacket sekiroPacket = await ReadPacket();
                            if (sekiroPacket.MessageType == MessageTypes.Heartbeat)
                            {
                                await ReportHeartbeatMsg(netStream, sekiroPacket);
                                continue;
                            }
                            var actionResult = await ExecFunc(sekiroPacket);
                            SekiroPacket replyMsg = ToReplyPacket(sekiroPacket, actionResult);
                            var respBuffer = replyMsg.ToBuffer();
                            await netStream.WriteAsync(respBuffer, 0, respBuffer.Length);
                            Serilog.Log.Information($"send seq :{sekiroPacket.Seq} response successfully.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Serilog.Log.Error($"something wrong,err:{ex?.ToString()},{ex.StackTrace}");
                }
                finally
                {
                    Serilog.Log.Warning($"restart client.");
                    await Task.Delay(5000);  // Wait for 5 seconds before reconnecting  
                }
            }

        }

        private SekiroPacket ToReplyPacket(SekiroPacket sekiroPacket, byte[] funcResult)
        {
            var replyMsg = new SekiroPacket(MessageTypes.SendToServer, sekiroPacket.Seq);
            replyMsg.Headers.Add("PAYLOAD_CONTENT_TYPE", "PAYLOAD_CONTENT_TYPE");
            replyMsg.Headers.Add("SEKIRO_GROUP", this.groupName);
            replyMsg.Headers.Add("SEKIRO_CLIENT_ID", this.clientId);
            replyMsg.Headers.Add("contentType", "application/json");
            replyMsg.Data = funcResult;
            return replyMsg;
        }
    }
}

