import axios from "axios"
export class Bitcoind {
    #config = null
    #path = ""
    #api = null
    constructor({isTest, host, account, passphrase, rpcUser, rpcPass}) {
        this.#config = {isTest, host, account, passphrase, rpcUser, rpcPass}
        if (isTest) {
            this.#path = `http://${host}:18332/`
        } else {
            this.#path = `http://${host}:8332/`
        }
        this.#api = axios.create({
            baseURL: this.#path,
            timeout: 1000,
            auth: { username: rpcUser, password: rpcPass },
            headers: {
                "Content-Type": "application/json;charset=utf-8",
                "Accept": "application/json"
            }
        });
    }
    #walletPath() {
        const {account} = this.#config
        if (account) {
            return `wallet/${account}`
        }
        return ""
    }
    // sendToAddress will send an amount in shatoshi to the destination address
    async sendToAddress(address, amount, comment, commentTo) {
        const fAmount = amount / 10**8
        const data = await this.#do("sendtoaddress", [address, fAmount, comment, commentTo])
    }
    async getBalance(label) {
        if (!label) {
            label = "*"
        }
        const { result } = await this.#do("getbalance", [label, 1])
        return result
    }
    async #do(method, params) {
        const { data } = await this.#api.post(this.#walletPath(),{
            method: method,
            params: params,
            id: "1",
            jsonrpc: "1.0"
        })
        return data
    }
}