import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
//import { KeyringPair } from '@polkadot/keyring/types.js';
import {WalletInterface} from "../interface.js";
import fs from "fs/promises";
import { cryptoWaitReady } from "@polkadot/util-crypto"
import axios from "axios";
import {waitFor} from "../../helper/helper.js";

const filterConsoleLog = () => {
    const originalLog = console.warn;
    console.warn = (...args) => {
        const message = args.join(' ');
        if (message.includes('API/INIT: RPC methods not decorated')) {
            return; // Bỏ qua cảnh báo
        }
        originalLog.apply(console, args);
    };
    return () => {
        console.warn = originalLog; // Khôi phục console.log
    };
};

export class Polkadot extends WalletInterface {
    #subscanKey = "4c3ad19bbc364e7794acca638857ab62"
    #subscanUrl = ""
    #decimals = 0
    #isTest = false
    #url = "wss://rpc.polkadot.io"
    network = {}
    /** @type {KeyringPair} */
    #keypair =  null

    #api = null;
    /**
     * @param network
     * @param isTest
     * @param {KeyringPair} keypair - The wallet's keypair
     */
    constructor(network,isTest, keypair) {
        super();
        this.network = network
        this.#isTest = isTest
        this.#keypair = keypair
        this.#subscanUrl = isTest ? 'https://westend.api.subscan.io' : 'https://polkadot.api.subscan.io';
        this.#decimals = isTest ? 12 : 10;
        if (isTest) {
            this.#url = "wss://westend-rpc.polkadot.io"
        }
        this.#api = null;
    }

    static async fromFilePath (network,isTest, path) {
        let data = await fs.readFile(path, { encoding: 'utf8' })
        await cryptoWaitReady();
        const keyring = new Keyring({ type: 'sr25519' }); // Polkadot dùng sr25519
        const keypair = keyring.addFromUri(data);
        return new Polkadot(network,isTest, keypair)
    }

    // connect to Polkadot node
    async connect() {
        if (!this.#api) {
            const restoreLog = filterConsoleLog();
            try {
                const provider = new WsProvider(this.#url);
                this.#api = await ApiPromise.create({ provider });
                await this.#api.isReady;
            } finally {
                restoreLog();
            }
        }
    }

    // disconnect to Polkadot node
    async disconnect() {
        if (this.#api) {
            await this.#api.disconnect();
            this.#api = null;
        }
    }

    getAddress() {
        return this.#keypair.address;
    }

    // get balance
    async getBalance() {
        try {
            await this.connect();

            const { data: { free, reserved, miscFrozen } } = await this.#api.query.system.account(this.#keypair.address);
            const decimals = this.#api.registry.chainDecimals[0];
            await this.disconnect();

            return Number(free) / 10**decimals;
        } catch (e) {
            await this.disconnect();
            throw e;
        }
    }

    // Gửi DOT đến một địa chỉ
    async sendFAmountToAddress(symbol,recipientAddress, amountInDOT) {
        try {
            await this.connect();
            if (!recipientAddress || typeof recipientAddress !== 'string' || recipientAddress.length !== 48) {
                throw new Error('address is not valid');
            }
            if (amountInDOT <= 0) {
                throw new Error('amount must be greater than 0');
            }

            const decimals = this.#api.registry.chainDecimals[0];
            const amountPlanck = BigInt(Math.floor(amountInDOT * 10**decimals));

            const transfer = this.#api.tx.balances.transferKeepAlive(recipientAddress, amountPlanck);
            let txHash;
            await new Promise((resolve, reject) => {
                transfer.signAndSend(this.#keypair, ({ status, events, dispatchError }) => {
                    if (status.isFinalized) {
                        txHash = transfer.hash.toHex();
                        if (dispatchError) {
                            let errorMessage = 'invalid transaction';
                            if (dispatchError.isModule) {
                                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                            }
                            reject(new Error(`Giao dịch thất bại: ${errorMessage}`));
                        } else {
                            resolve();
                        }
                    }
                }).catch(reject);
            });

            await this.disconnect();
            return txHash;
        } catch (error) {
            await this.disconnect();
            throw error;
        }
    }

    async transactionInfo(txHash, num) {
        try {
            if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x') || txHash.length !== 66) {
                throw new Error('Hash giao dịch không hợp lệ. Phải là chuỗi hex 32 byte bắt đầu bằng 0x.');
            }
            await this.connect();

            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'PolkadotWallet/1.0'
            };
            if (this.#subscanKey) {
                headers['X-API-Key'] = this.#subscanKey;
            }

            const response = await axios.post(`${this.#subscanUrl}/api/scan/extrinsic`, {
                hash: txHash
            }, { headers });

            if (response.data.code !== 0 || !response.data.data) {
                return {
                    txId: txHash,
                    status: 'NotFound',
                    error: response.data.message || 'tx not found.',
                    blockHash: null,
                    blockHeight: null,
                    timestamp: null,
                    confirmations: 0,
                };
            }

            const { data } = response.data;
            if (data.transfer === null) {
                if (num > 5) {
                    return {
                        txId: txHash,
                        status: 'NotFound',
                        error: response.data.message || 'tx not found.',
                        blockHash: null,
                        blockHeight: null,
                        timestamp: null,
                        confirmations: 0,
                    };
                }
                if (!Number.isInteger(num)) {
                    num = 0
                }
                await waitFor(5)
                return this.transactionInfo(txHash, num+1)
            }

            const header = await this.#api.rpc.chain.getHeader();
            const currentBlockNumber = header.number.toNumber();

            const confirmations = data.block_num ? Math.max(0, currentBlockNumber - data.block_num + 1) : 0;

            const txInfo = {
                txId: txHash,
                from: data.transfer.from,
                to: data.transfer.to,
                amount: +data.transfer.amount,
                unit: data.transfer.asset_symbol,
                blockHash: data.block_hash || null,
                blockHeight: data.block_num || null,
                timestamp: data.block_timestamp ? new Date(data.block_timestamp * 1000).toISOString() : null,
                fee: data.fee ? Number(data.fee) / 10**this.#decimals : 0,
                status: data.success ? 'Success' : 'Failed',
                confirmations,
            };

            return txInfo;
        } catch (error) {
            await this.disconnect();
            throw error;
        }
    }
}
