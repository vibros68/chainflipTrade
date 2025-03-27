import axios from "axios"
import {WalletInterface} from "../interface.js"
export class Bitcoind extends WalletInterface {
    #config = null
    #path = ""
    #api = null
    network = {}
    constructor(network,isTest,{host, account, passphrase, rpcUser, rpcPass}) {
        super();
        this.network = network
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
    // sendToAddress will send an amount in satoshi to the destination address
    async sendToAddress(address, amount, comment, commentTo) {
        const fAmount = amount / 10**8
        const {result, error} = await this.#do("sendtoaddress", [address, fAmount, comment, commentTo])
        return result
    }
    async getBalance(label) {
        if (!label) {
            label = "*"
        }
        const { result } = await this.#do("getbalance", [label, 1])
        return result
    }
    async getAddress() {
        const { result } = await this.#do("getnewaddress", [])
        return result
    }
    async transactionInfo(txId) {
        const { result } = await this.#do("gettransaction", [txId])
        const {amount,fee, confirmations, blockhash, blockheight, time, txid, details} = result
        return {
            amount,fee, confirmations, blockHash: blockhash, blockHeight:blockheight, time: time*1000, txId: txid
        }
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