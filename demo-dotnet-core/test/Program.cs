// See https://aka.ms/new-console-template for more information
using System;
using System.Threading.Tasks;
using SekiroClientDotnet;

internal class Program
{
    private static async Task Main(string[] args)
    {
        var sekiroClient = new SekiroClient(
            host: "sekiro.iinti.cn", port: 5612, groupName: "test-dotnet");
        await sekiroClient.Start();
    }
}