import {WalletInterface} from "../interface.js";
import {ethers} from "ethers";
import fs from "fs/promises";
import {Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";
export class Geth extends WalletInterface {
    #connect = null
    /** @type {ethers.Wallet} */
    #wallet = null
    /**
     * @param isTest
     * @param {ethers.Wallet} wallet - The wallet's keypair
     */
    constructor(isTest, wallet) {
        super();
        let providerUrl = "https://eth-sepolia.g.alchemy.com/v2/WWQPK0icDlSTIPxj5sIa9_0lMlYdru6E"
        this.#connect = new ethers.JsonRpcProvider(providerUrl);
        this.#wallet = wallet.connect(this.#connect)
    }
    async sendToAddress(address, amount, comment, commentTo) {
        return ""
    }
    async getBalance(label) {
        const balanceWei = await this.#connect.getBalance(this.#wallet.address);
        return ethers.formatEther(balanceWei);
    }
    async getAddress() {
        if (!this.#wallet) {
            throw new Error('No wallet loaded');
        }
        return this.#wallet.address;
    }
    async transactionInfo(txId) {
        // Get original transaction (for value, gas price)
        const tx = await this.#connect.getTransaction(txId);
        if (!tx) {
            return {
                status: 'pending',
                confirmations: 0,
                blockNumber: null,
            };
        }
        const receipt = await this.#connect.getTransactionReceipt(txId);
        // Get latest block number
        const latestBlock = await this.#connect.getBlockNumber();
        const confirmations = latestBlock - tx.blockNumber + 1;
        // Calculate fee (gasUsed * effectiveGasPrice)
        const feeWei = receipt.gasUsed * (tx.effectiveGasPrice || tx.gasPrice); // effectiveGasPrice post-EIP-1559
        const feeEther = ethers.formatEther(feeWei);

        // Amount sent in ETH
        const amountEther = ethers.formatEther(tx.value);
        return {
            status: 'Success',
            confirmations: confirmations,
            blockHeight: tx.blockNumber,
            blockHash: tx.blockHash,
            time: 0,
            fee: feeEther,
            amount: amountEther,
            txId
        };
    }
    static async fromFilePath (isTest, filePath, password) {
        const keystoreJson = await fs.readFile(filePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
        return new Geth(isTest, wallet)
    }
}