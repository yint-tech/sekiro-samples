// See https://aka.ms/new-console-template for more information
using System;
using System.Text;
using Newtonsoft.Json.Linq;
using SekiroClientDotnet;

internal class Program
{
    private static async Task Main(string[] args)
    {
        var sekiroClient = new SekiroClient(
            host: "sekiro.iinti.cn",
            port: 5612,
            groupName: "test-dotnet");
        sekiroClient.AddAction("testAction", (JToken request) =>
        {
            var resp = new { msg = "test successfully.", request = request };
            return Task.FromResult(Encoding.UTF8.GetBytes(JToken.FromObject(resp).ToString()));
        });
        await sekiroClient.Start();
    }
}