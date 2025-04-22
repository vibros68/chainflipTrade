import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
//import { KeyringPair } from '@polkadot/keyring/types.js';
import {WalletInterface} from "../interface.js";
import fs from "fs/promises";
import { cryptoWaitReady } from "@polkadot/util-crypto"

export class Polkadot extends WalletInterface {
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
        if (isTest) {
            this.#url = "wss://westend-rpc.polkadot.io"
        }
        this.keyring = new Keyring({ type: 'sr25519' }); // Polkadot dùng sr25519
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
            const provider = new WsProvider(this.#url);
            this.#api = await ApiPromise.create({ provider });
            await this.#api.isReady;
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
    async sendToAddress(recipientAddress, amountInDOT) {
        try {
            await this.connect();
            if (!this.seed) {
                throw new Error('Seed phrase is not provided');
            }
            if (!recipientAddress || typeof recipientAddress !== 'string' || recipientAddress.length !== 48) {
                throw new Error('address is not valid');
            }
            if (amountInDOT <= 0) {
                throw new Error('amount must be greater than 0');
            }

            const sender = this.keyring.addFromUri(this.seed);
            const decimals = this.#api.registry.chainDecimals[0];
            const amountPlanck = BigInt(Math.floor(amountInDOT * 10**decimals));

            const transfer = this.#api.tx.balances.transferKeepAlive(recipientAddress, amountPlanck);
            const hash = await transfer.signAndSend(sender, ({ status }) => {
                if (status.isInBlock) {
                    console.log(`Giao dịch được thêm vào khối: ${status.asInBlock}`);
                }
                if (status.isFinalized) {
                    console.log(`Giao dịch hoàn tất: ${hash.toHex()}`);
                }
            });

            await this.disconnect();
            return hash.toHex();
        } catch (error) {
            await this.disconnect();
            throw error;
        }
    }

    async transactionInfo(txHash) {
        try {
            await this.connect();
            if (!txHash || typeof txHash !== 'string') {
                throw new Error('Hash giao dịch không hợp lệ');
            }

            // block information
            const signedBlock = await this.#api.rpc.chain.getBlock();
            const allRecords = await this.#api.query.system.events.at(signedBlock.block.header.hash);

            let txInfo = null;
            allRecords.forEach(({ event, phase }) => {
                if (phase.isApplyExtrinsic && event.section === 'balances' && event.method === 'Transfer') {
                    const { from, to, amount } = event.data;
                    const eventHash = phase.asApplyExtrinsic.toString();
                    if (eventHash === txHash || txHash.includes(eventHash)) {
                        txInfo = {
                            hash: txHash,
                            from: from.toString(),
                            to: to.toString(),
                            amount: Number(amount) / 10**this.#api.registry.chainDecimals[0],
                            unit: 'DOT',
                            blockHash: signedBlock.block.header.hash.toHex(),
                            status: 'Success' // Giả định thành công nếu tìm thấy
                        };
                    }
                }
            });

            if (!txInfo) {
                // Kiểm tra trạng thái giao dịch qua RPC nếu không tìm thấy trong khối
                const tx = await this.#api.rpc.payment.queryInfo(txHash);
                txInfo = {
                    hash: txHash,
                    status: tx.class.toString() === 'Normal' ? 'Pending' : 'Unknown',
                    fee: tx.partialFee ? Number(tx.partialFee) / 10**this.#api.registry.chainDecimals[0] : 0
                };
            }

            await this.disconnect();
            return txInfo;
        } catch (error) {
            await this.disconnect();
            throw error;
        }
    }
}
