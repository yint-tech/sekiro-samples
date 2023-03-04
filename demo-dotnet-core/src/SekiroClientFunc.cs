
using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace SekiroClientDotnet
{
    /// <summary>
    /// Func相关处理
    /// </summary>
    public partial class SekiroClient
    {

        private async Task<byte[]> ExecFunc(SekiroPacket sekiroPacket)
        {
            byte[] funcResp;
            try
            {
                var requestJson = JToken.Parse(Encoding.UTF8.GetString(sekiroPacket.Data));
                var actionName = requestJson["action"]?.ToString();
                var actionHandler = FuncList.GetValueOrDefault(actionName);
                if (actionHandler == null)
                {
                    var err = $"{actionName} not found.";
                    funcResp = ToFuncErrorResp(sekiroPacket, requestJson, err);
                }
                else
                {
                    funcResp = await actionHandler.Invoke(requestJson);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ExecFunc fail, err:{ex?.ToString()},StackTrace:{ex?.StackTrace}");
                funcResp = ToFuncErrorResp(sekiroPacket, sekiroPacket.Data, ex?.ToString());
            }
            return funcResp;
        }

        private static byte[] ToFuncErrorResp(SekiroPacket sekiroPacket, Object request, string err)
        {
            byte[] funcResp;
            var actionNotFoundResp = new
            {
                code = "-1",
                error = err,
                seq = sekiroPacket.Seq,
                ts = DateTime.Now.ToString(),
                request = request,
            };
            funcResp = Encoding.UTF8.GetBytes(JToken.FromObject(actionNotFoundResp).ToString());
            return funcResp;
        }

    }
}