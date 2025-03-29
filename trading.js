import { SwapSDK } from "@chainflip/sdk/swap";
import {newWallet} from "./blockchains/wallets.js";
import {WalletInterface} from "./blockchains/interface.js";
import {waitFor} from "./helper/helper.js";
import {Binance} from "./helper/binance.js";

export class Trading {
    /** @type {SwapSDK} */
    #swapSDK = null;
    #assets = [];
    /** @type {WalletInterface} */
    #fromWallet = null;
    /** @type {WalletInterface} */
    #toWallet = null;
    #order = {}
    #isTest = false
    #binance = new Binance()
    /**
     * @param {Boolean} isTest
     * @param {WalletInterface} fromWallet - The wallet's keypair
     * @param {WalletInterface} toWallet
     * @param {Object} order
     */
    constructor(isTest, fromWallet, toWallet, order) {
        let network = "perseverance"
        if (!isTest) {
            network = "mainnet"
        }
        const swapConfig = {
            network,
        };
        this.#isTest = isTest
        this.#swapSDK = new SwapSDK(swapConfig);
        this.#order = order
        this.#fromWallet = fromWallet
        this.#toWallet = toWallet
    }
    static async fromConfig(isTest, from, to, order) {
        const {network: fromNetwork, wallet: fromCfg} = from
        const fromWallet = await newWallet(isTest, fromNetwork, fromCfg);
        const {network: toNetwork, wallet: toCfg} = to
        const toWallet = await newWallet(isTest, toNetwork, toCfg)

        return new Trading(isTest, fromWallet, toWallet, order)
    }
    async run() {
        this.#assets = await this.#swapSDK.getAssets();
        while (true) {
            const orderId = await this.makeOrder()
            if (!orderId) {
                await waitFor(60*60)
            } else {
                await waitFor(4*60*60)
            }
        }

    }
    async supportedCoins() {
        const assets = await this.#swapSDK.getAssets();
        const assetMap = {
            Bitcoin: [],
            Solana: [],
            Ethereum: [],
            // Arbitrum: [],
            // Polkadot: [],
        }
        for (let asset of assets) {
            const map = assetMap[asset.chain]
            if (map) {
                map.push(asset)
            }
        }
        for (let chain in assetMap) {
            console.log(`chain ${chain}: `)
            for (let asset of assetMap[chain]) {
                process.stdout.write(`  ${asset.asset}: decimals[${asset.decimals}]`)
                if (asset.contractAddress) {
                    process.stdout.write(` .contract: ${asset.contractAddress}`)
                }
                process.stdout.write("\n")
            }
        }
    }
    async check(orderId) {
        const orderStatus = await this.#swapSDK.getStatusV2({
            id: orderId,
        });
        const {
            state,  srcAsset, srcChain, destAsset, destChain, fees, destAddress,
            srcChainRequiredBlockConfirmations,
            depositChannel, lastStatechainUpdateAt, estimatedDurationSeconds,
            swap, swapEgress
        } = orderStatus
        console.log(`Order[${depositChannel.id}] - status[${state}]. From[${srcAsset}/${srcChain}] - To[${destAsset}/${destChain}]`)
        console.log(`Destination address: ${destAddress}`)
        console.log(`Required confirms: ${srcChainRequiredBlockConfirmations}. Estimate duration seconds: ${estimatedDurationSeconds}`)
    }
    async makeOrder() {
        let fAmount = Math.random() * (this.#order.max - this.#order.min) + this.#order.min;
        let fromAsset = this.assetConfig(this.#order.fromSymbol, this.#fromWallet.network.chain)
        let toAsset = this.assetConfig(this.#order.toSymbol, this.#toWallet.network.chain)
        let amount = Math.floor(fAmount*(10**fromAsset.decimals))
        fAmount = amount / (10**fromAsset.decimals)
        console.log(`making an order with amount: ${fAmount} \$${fromAsset.symbol}`)
        const quoteRequest = {
            srcChain: fromAsset.chain,
            destChain: toAsset.chain,
            srcAsset: this.#order.fromSymbol,
            destAsset: this.#order.toSymbol,
            amount: amount.toString(),
        };
        const { quotes } = await this.#swapSDK.getQuoteV2(quoteRequest)
        const quote = quotes.find((quote) => quote.type === 'REGULAR');
        let receiveAmount = +quote.egressAmount
        let fReceiveAmount = receiveAmount / (10**toAsset.decimals)
        const binanceRate = await this.#binance.getPrice({
            from: this.#order.fromSymbol,
            to: this.#order.toSymbol
        })
        const maxDiffRate = +this.#order.maxDiffPrice
        console.log(`Receive ${fReceiveAmount} \$${this.#order.toSymbol} with rate: ${quote.estimatedPrice}`)
        if (maxDiffRate) {
            const minRate = binanceRate * (1-this.#order.maxDiffPrice)
            if (quote.estimatedPrice < minRate) {
                console.log(`The rate is lower than min rate: ${minRate} . Stop!`)
                return
            } else {
                console.log(`The rate is higher than min rate: ${minRate} !`)
            }
        }
        const refundAddress = await this.#fromWallet.getAddress()
        const destAddress = await this.#toWallet.getAddress()
        console.log("refundAddress: ", refundAddress)
        console.log("destAddress: ", destAddress)
        const callDepositAddressRequest = {
            quote,
            destAddress: destAddress,
            // ccmParams: {
            //     message: "0xdeadc0de",
            //     gasBudget: (0.001e8).toString(), // 0.001 BTC will be swapped for ETH to pay for gas
            // },
            fillOrKillParams: {
                slippageTolerancePercent: quote.recommendedSlippageTolerancePercent, // use recommended slippage tolerance from quote
                refundAddress: refundAddress, // address to which assets are refunded
                retryDurationBlocks: 100, // 100 blocks * 6 seconds = 10 minutes before deposits are refunded
            },
        };
        const depositInfo = await this.#swapSDK.requestDepositAddressV2(callDepositAddressRequest)
        const { depositAddress, depositChannelId } = depositInfo
        console.log('Deposit address: ', depositAddress);
        console.log('Deposit Channel Id: ', depositChannelId)
        process.stdout.write(`Start sending coin: ${fAmount} \$${this.#order.fromSymbol} `)
        await waitFor(10,true)
        process.stdout.write("\n")
        const sendTxId = await this.#fromWallet.sendToAddress(this.#order.fromSymbol, depositAddress, amount)
        while (true) {
            // wait for 10 seconds
            await waitFor(10)
            let {confirmations} = await this.#fromWallet.transactionInfo(sendTxId)
            confirmations = +confirmations
            console.log(`tx: ${sendTxId} got ${confirmations} confirmations`)
            if (confirmations && confirmations >=6) {
                break
            }
        }
        const receiveTxId = await this.waitForOrderComplete(depositChannelId)
        if (receiveTxId === null) {
            return
        }
        process.stdout.write(`checking received tx: ${receiveTxId}`)
        while (true) {
            let {confirmations} = await this.#toWallet.transactionInfo(receiveTxId)
            confirmations = +confirmations
            process.stdout.write(` got ${confirmations} confirmations`)
            if (confirmations && confirmations >=6) {
                return depositChannelId
            }
            await waitFor(10,true)
        }
    }
    async waitForOrderComplete(depositChannelId) {
        console.log(`waiting for order completed: ${depositChannelId}`)
        const startAt = new Date();
        while (true) {
            process.stdout.write(`checking ${depositChannelId}: `)
            const orderStatus = await this.#swapSDK.getStatusV2({
                id: depositChannelId,
            });
            const {
                state,  srcAsset, srcChain, destAsset, destChain, fees, destAddress,
                srcChainRequiredBlockConfirmations,
                depositChannel, lastStatechainUpdateAt, estimatedDurationSeconds,
                swap, swapEgress
            } = orderStatus
            if (state === "COMPLETED") {
                console.log(`status: ${state}. got txId: ${swapEgress.txRef}`)
                return swapEgress.txRef
            } else {
                process.stdout.write(`status: ${state} `)
                const waited = new Date().getTime() - startAt.getTime()
                // waited more than 1 hour
                if (waited > 3600000){
                    process.stdout.write("\n")
                    console.log("waited more than 1 hour. stop checking. the order supposes to be failed")
                    return null
                }
                await waitFor(10,true)
                process.stdout.write("\n")
            }
        }
    }
    assetConfig(symbol,chain) {
        for (let asset of this.#assets) {
            if (asset.symbol === symbol && asset.chain === chain) {
                return asset
            }
        }
        return null
    }
}