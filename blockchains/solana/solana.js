import fs from "fs/promises";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import {WalletInterface} from "../interface.js";
export class Solana extends WalletInterface {
    #isTest = false
    #mainToken = {
        symbol: "SOL",
        decimals: 9,
    }
    #contractToken = {
        USDC: {
            symbol: "USDC",
            decimals: 6,
            mainnetContract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            devnetContract: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        }
    }
    network = {}
    /** @type {Keypair} */
    #keypair =  null
    /** @type {Connection} */
    #connection = null;
    /**
     * @param network
     * @param isTest
     * @param {Keypair} keypair - The wallet's keypair
     */
    constructor(network,isTest, keypair) {
        super();
        this.#isTest = isTest
        this.network = network
        if (!(keypair instanceof Keypair)) {
            throw new Error('keypair must be an instance of Keypair');
        }
        this.#keypair = keypair
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
        const balanceInLamports = await this.#connection.getBalance(this.#keypair.publicKey);
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

    #getAsset(symbol) {
        const asset = this.#contractToken[symbol]
        if (!asset) {
            throw new Error(`symbol ${symbol} is not supported`)
        }
        const { decimals, mainnetContract, devnetContract} = asset
        if (this.#isTest) {
            return {decimals, contract: devnetContract}
        }
        return {decimals, contract: mainnetContract}
    }

    async sendFAmountToAddress(symbol, address, fAmount) {
        if (symbol === "SOL") {
            const amount = fAmount*LAMPORTS_PER_SOL
            return await this.sendSolToAddress(address, amount)
        }
        const {decimals} = this.#getAsset(symbol)
        return await this.sendToAddress(symbol, address, fAmount*(10**decimals))
    }

    async sendToAddress(symbol, address, amount) {
        if (symbol.toUpperCase() === "SOL") {
            return await this.sendSolToAddress(address, amount)
        }
        const {contract} = this.#getAsset(symbol)
        // Source ATA (payer's contract account)
        const sourceATA = await getAssociatedTokenAddress(
            new PublicKey(contract),
            this.#keypair.publicKey
        );

        // Destination ATA (recipient's contract account)
        const destATA = await getAssociatedTokenAddress(
            new PublicKey(contract),
            new PublicKey(address)
        );

        // Check balances and ATAs
        const sourceAccountInfo = await this.#connection.getAccountInfo(sourceATA);
        if (!sourceAccountInfo) {
            throw new Error('Source ATA does not exist or has no USDT. Fund it first.');
        }

        const destAccountInfo = await this.#connection.getAccountInfo(destATA);
        const transaction = new Transaction();

        // Create destination ATA if it doesn’t exist
        if (!destAccountInfo) {
            const createATAInstruction = createAssociatedTokenAccountInstruction(
                this.#keypair.publicKey, // Payer (funds the account creation)
                destATA,             // New ATA
                new PublicKey(address), // Owner of the ATA
                new PublicKey(contract),          // Token mint
                TOKEN_PROGRAM_ID
            );
            transaction.add(createATAInstruction);
        }

        // Transfer instruction
        const transferInstruction = createTransferInstruction(
            sourceATA,           // Source ATA
            destATA,            // Destination ATA
            this.#keypair.publicKey, // Authority (payer owns source ATA)
            amount,             // Amount in token units (e.g., 1 USDT = 1,000,000 with 6 decimals)
            [],                 // No multi-signers
            TOKEN_PROGRAM_ID
        );

        transaction.add(transferInstruction);

        // Send transaction
        const signature = await this.#connection.sendTransaction(transaction, [this.#keypair]);

        await this.#connection.confirmTransaction(signature, 'confirmed');
        return signature
    }

    async sendSolToAddress(address, amount, comment, commentTo) {
        // Convert recipient public key string to PublicKey object
        const recipientPublicKey = new PublicKey(address);
        // Convert SOL amount to lamports
        const lamports = amount//BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

        // Create a transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.#keypair.publicKey, // Sender's public key
                toPubkey: recipientPublicKey,       // Recipient's public key
                lamports: lamports,                 // Amount in lamports
            })
        );
        // Fetch recent blockhash (required for transaction validity)
        const { blockhash } = await this.#connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.#keypair.publicKey; // Sender pays the fee

        // Sign the transaction with the sender's keypair
        transaction.sign(this.#keypair);
        // Send the transaction
        const signature = await this.#connection.sendRawTransaction(transaction.serialize());

        // Confirm the transaction
        await this.#connection.confirmTransaction(signature, 'confirmed');
        return signature;
    }

    async getAddress() {
        return this.#keypair.publicKey.toBase58()
    }
}