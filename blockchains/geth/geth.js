import {WalletInterface} from "../interface.js";
export class Geth extends WalletInterface {
    constructor(isTest, path) {
        super();
    }
    async sendToAddress(address, amount, comment, commentTo) {
        return ""
    }
    async getBalance(label) {
        return 0
    }
    async getAddress() {
        return "0xCC5E1Ee0B2792634D2Ec0C98e490C144d96A7B24"
    }
}