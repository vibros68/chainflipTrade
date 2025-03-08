import { SwapSDK } from "@chainflip/sdk/swap";
//import { Wallet } from "ethers";
import { Trading } from "./trading.js";

const t = new Trading({
    isTest: true,
    from: {
        symbol: "BTC",
        chain: "Bitcoin"
    },
    to: {
        symbol: "SOL",
        chain: "Solana"
    },
    order: {
        min: 0.0005,
        max: 0.0015,
        destAddress: "4YmwKrCiW836uXhRcm7A8BC9b77K55gBKfPj2coFxK8m",
        refundAddress: "tb1qkcpk6zyh626f6zgsx5mzxtnfyyj4j986nla9f4"
    }
})
await t.init()
let command = "run"
let params = []
if (process.argv === 2) {
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
        break
    default:
        console.log("invalid command")
}
