import {WalletInterface} from "../interface.js";
import {ethers} from "ethers";
import fs from "fs/promises";
export class Geth extends WalletInterface {
    network = {}
    #mainToken = {
        symbol: "ETH",
        decimals: 18,
    }
    #contractToken = {
        USDC: {
            symbol: "USDC",
            decimals: 6,
            mainnetContract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            testnetContract: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        },
        FLIP: {
            symbol: "FLIP",
            decimals: 18,
            mainnetContract: "0x826180541412D574cf1336d22c0C0a287822678A",
            testnetContract: "0xdC27c60956cB065D19F08bb69a707E37b36d8086"
        },
        USDT: {
            symbol: "USDT",
            decimals: 6,
            mainnetContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            testnetContract: "0x27CEA6Eb8a21Aae05Eb29C91c5CA10592892F584"
        }
    }
    #connect = null
    /** @type {ethers.Wallet} */
    #wallet = null
    /**
     * @param {Object} network
     * @param isTest
     * @param {ethers.Wallet} wallet - The wallet's keypair
     */
    constructor(network,isTest, wallet) {
        super();
        this.network = network
        let providerUrl = "https://eth-sepolia.g.alchemy.com/v2/WWQPK0icDlSTIPxj5sIa9_0lMlYdru6E"
        if (!isTest) {
            providerUrl = "https://eth-mainnet.g.alchemy.com/v2/WWQPK0icDlSTIPxj5sIa9_0lMlYdru6E"
        }
        this.#connect = new ethers.JsonRpcProvider(providerUrl);
        this.#wallet = wallet.connect(this.#connect)
    }
    async sendToAddress(symbol, address, amount, comment, commentTo) {
        if (!ethers.isAddress(address)) throw new Error('Invalid recipient address');

        const tx = await this.#wallet.sendTransaction({
            to: address,
            value: ethers.parseEther(amount),
        });

        await tx.wait(); // Wait for 1 confirmation
        return tx.hash;
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
    static async fromFilePath (network, isTest, filePath, password) {
        const keystoreJson = await fs.readFile(filePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
        return new Geth(network,isTest, wallet)
    }
}