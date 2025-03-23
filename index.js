import { SwapSDK } from "@chainflip/sdk/swap";
//import { Wallet } from "ethers";
import { Trading } from "./trading.js";

const t = new Trading({
    isTest: true,
    // from: {
    //     symbol: "BTC",
    //     chain: "Bitcoin",
    //     cfg: {
    //         host: "localhost",
    //         rpcUser: "root",
    //         rpcPass: "123456",
    //         passphrase: "123456"
    //     }
    // },
    from: {
        symbol: "SOL",
        chain: "Solana",
        cfg: {
            path: ".local/sol02.json"
        }
    },
    to: {
        symbol: "ETH",
        chain: "Ethereum",
        cfg: {}
    },
    order: {
        min: 5,
        max: 10,
        //destAddress: "4YmwKrCiW836uXhRcm7A8BC9b77K55gBKfPj2coFxK8m", // SOL
        destAddress: "0xCC5E1Ee0B2792634D2Ec0C98e490C144d96A7B24", // ETH
        refundAddress: "tb1qkcpk6zyh626f6zgsx5mzxtnfyyj4j986nla9f4"
    }
})
await t.init()
let command = "run"
let params = []
if (process.argv.length === 2) {
    command = "run"
} else {
    command = process.argv[2]
    params = process.argv.slice(2)
}
switch (command) {
    case "run":
        await t.run();
        break
    case "check":
        if (params.length === 0) {
            throw new Error('Please provide order id')
        }
        await t.check(params[1])
        const tx = await t.waitForOrderComplete(params[1])
        console.log(tx)
        break
    default:
        console.log("invalid command")
}
