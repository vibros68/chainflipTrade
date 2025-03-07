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
        max: 0.0015
    }
})
await t.init()
t.run()