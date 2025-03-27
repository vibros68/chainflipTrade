import fs from "fs/promises";
import { Trading } from "./trading.js";
import YAML from "yaml"

const configData = await fs.readFile("config.yaml", { encoding: 'utf8' })
const {isTest, wallets, order} = YAML.parse(configData)

/** @type {Trading} */
const t = await Trading.fromConfig(isTest, wallets[order.from], wallets[order.to], order)

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
    case "available-currency":
        await t.supportedCoins()
        break
    default:
        console.log("invalid command")
}
process.exit()