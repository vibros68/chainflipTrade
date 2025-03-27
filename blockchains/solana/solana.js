import fs from "fs/promises";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {WalletInterface} from "../interface.js";
export class Solana extends WalletInterface {
    network = {}
    /** @type {Connection} */
    #connection = null;
    /**
     * @param network
     * @param isTest
     * @param {Keypair} keypair - The wallet's keypair
     */
    constructor(network,isTest, keypair) {
        super();
        this.network = network
        if (!(keypair instanceof Keypair)) {
            throw new Error('keypair must be an instance of Keypair');
        }
        this.keypair = keypair
        let url = "https://api.devnet.solana.com"
        if (!isTest) {
            url = "https://api.mainnet-beta.solana.com"
        }
        this.#connection = new Connection(url);
    }
    static async fromFilePath (network,isTest, path) {
        let data = await fs.readFile(path, { encoding: 'utf8' })
        const walletData = JSON.parse(data);
        const keypairArray = Uint8Array.from(walletData);
        const keypair = Keypair.fromSecretKey(keypairArray);
        return new Solana(network,isTest, keypair)
    }
    async getBalance() {
        const balanceInLamports = await this.#connection.getBalance(this.keypair.publicKey);
        return balanceInLamports / LAMPORTS_PER_SOL;
    }

    async transactionInfo(txId) {
        const tx = await this.#connection.getParsedTransaction(txId, {
            commitment: 'confirmed', // Can use 'finalized' for maximum assurance
            maxSupportedTransactionVersion: 0, // Supports legacy transactions
        });

        if (!tx) {
            console.log(`Transaction ${txId} not found or still processing`);
            return {
                status: 'Failed',
                confirmations: 0
            };
        }

        // Extract key details
        const { slot, blockTime, meta, transaction } = tx;
        const latestSlot = await this.#connection.getSlot('confirmed');
        const slotDifference = latestSlot - slot;
        const isConfirmed = meta.err === null; // No error means success

        // Parse transfer details (assuming a simple SOL transfer)
        const instruction = transaction.message.instructions[0];
        const amountInSOL = instruction.parsed?.info?.lamports / LAMPORTS_PER_SOL;

        return {
            status: isConfirmed ? 'Success' : 'Failed',
            blockHeight: slot,
            confirmations: slotDifference,
            time: blockTime,
            fee: meta.fee / LAMPORTS_PER_SOL,
            amount: amountInSOL || null,
            txId
        };
    }

    async sendToAddress(address, amount, comment, commentTo) {
        // Convert recipient public key string to PublicKey object
        const recipientPublicKey = new PublicKey(address);
        // Convert SOL amount to lamports
        const lamports = amount//BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

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