import fs from "fs/promises";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {WalletInterface} from "../interface.js";
export class Solana extends WalletInterface {
    /** @type {Connection} */
    #connection = null;
    /**
     * @param isTest
     * @param {Keypair} keypair - The wallet's keypair
     */
    constructor(isTest, keypair) {
        super();
        this.keypair = keypair
        let url = "https://api.devnet.solana.com"
        if (!isTest) {
            url = "https://api.mainnet-beta.solana.com"
        }
        this.#connection = new Connection(url);
    }
    static async fromFilePath (isTest, path) {
        let data = await fs.readFile(path, { encoding: 'utf8' })
        const walletData = JSON.parse(data);
        const keypairArray = Uint8Array.from(walletData);
        const keypair = Keypair.fromSecretKey(keypairArray);
        return new Solana(isTest, keypair)
    }
    async getBalance() {
        const balanceInLamports = await this.#connection.getBalance(this.keypair.publicKey);
        return balanceInLamports / LAMPORTS_PER_SOL;
    }

    async sendToAddress(address, amount, comment, commentTo) {
        // Convert recipient public key string to PublicKey object
        const recipientPublicKey = new PublicKey(address);
        // Convert SOL amount to lamports
        const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

        // Create a transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.keypair.publicKey, // Sender's public key
                toPubkey: recipientPublicKey,       // Recipient's public key
                lamports: lamports,                 // Amount in lamports
            })
        );
        // Fetch recent blockhash (required for transaction validity)
        const { blockhash } = await this.#connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.keypair.publicKey; // Sender pays the fee

        // Sign the transaction with the sender's keypair
        transaction.sign(this.keypair);
        // Send the transaction
        const signature = await this.#connection.sendRawTransaction(transaction.serialize());

        // Confirm the transaction
        await this.#connection.confirmTransaction(signature, 'confirmed');
        return signature;
    }

    async getAddress() {
        return this.keypair.publicKey.toBase58()
    }
}