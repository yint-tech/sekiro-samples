import SekiroClient from "./sekiroFrida"

// test frida
const client = new SekiroClient({sekiroGroup: "test_frida", clientId: "test"});
client.registerAction("testAction", function (request, resolve) {
    resolve("ok");
});