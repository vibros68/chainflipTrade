import { SwapSDK } from "@chainflip/sdk/swap";
import {newWallet} from "./blockchains/wallets.js";
import {WalletInterface} from "./blockchains/interface.js";

export class Trading {
    swapSDK = null;
    assets = [];
    from = {};
    to = {};
    /** @type {WalletInterface} */
    fromWallet = null;
    /** @type {WalletInterface} */
    toWallet = null;
    order = {}
    isTest = false
    constructor({isTest, from, to, order}) {
        let network = "perseverance"
        if (!isTest) {
            network = ""
        }
        const swapConfig = {
            network, // Testnet
            //backendUrl: "https://chainflip-swap-perseverance.chainflip.io",
            //signer: Wallet.fromPhrase(process.env.WALLET_MNEMONIC_PHRASE),
            // broker: {
            //     url: 'https://testnet-broker.chainflip.io',
            //     commissionBps: 0, // basis points, i.e. 100 = 1%
            // },
        };
        this.isTest = isTest
        this.swapSDK = new SwapSDK(swapConfig);
        this.from = from
        this.to = to
        this.order = order
    }
    async init() {
        this.assets = await this.swapSDK.getAssets();
        const {symbol: fromSymbol, chain: fromChain, cfg: fromCfg} = this.from
        fromCfg.isTest = this.isTest
        this.fromWallet = newWallet({symbol: fromSymbol, chain: fromChain, cfg: fromCfg});
        const {symbol: toSymbol, chain: toChain, cfg: toCfg} = this.to
        toCfg.isTest = this.isTest
        fromCfg.isTest = this.isTest
        this.toWallet = newWallet({symbol: toSymbol, chain: toChain, cfg: toCfg})
    }
    async run() {
        await this.makeOrder()
    }
    async check(orderId) {
        const orderStatus = await this.swapSDK.getStatusV2({
            id: orderId,
        });
        const {
            state,  srcAsset, srcChain, destAsset, destChain, fees, destAddress,
            srcChainRequiredBlockConfirmations,
            depositChannel, lastStatechainUpdateAt, estimatedDurationSeconds
        } = orderStatus
        console.log(`Order[${depositChannel.id}] - status[${state}]. From[${srcAsset}/${srcChain}] - To[${destAsset}/${destChain}]`)
        console.log(`Destination address: ${destAddress}`)
        console.log(`Required confirms: ${srcChainRequiredBlockConfirmations}. Estimate duration seconds: ${estimatedDurationSeconds}`)
        console.log(orderStatus)
    }
    async makeOrder() {
        let fAmount = Math.random() * (this.order.max - this.order.min) + this.order.min;
        let fromAsset = this.assetConfig(this.from)
        let toAsset = this.assetConfig(this.to)
        let amount = Math.floor(fAmount*(10**fromAsset.decimals))
        fAmount = amount / (10**fromAsset.decimals)
        console.log(`making an order with amount: ${fAmount} \$${fromAsset.symbol}`)
        const quoteRequest = {
            srcChain: fromAsset.chain,
            destChain: toAsset.chain,
            srcAsset: fromAsset.symbol,
            destAsset: toAsset.symbol,
            amount: amount.toString(),
            // brokerCommissionBps: 100, // 100 basis point = 1%
            // affiliateBrokers: [
            //     { account: "cFM8kRvLBXagj6ZXvrt7wCM4jGmHvb5842jTtXXg3mRHjrvKy", commissionBps: 50 }
            // ],
        };
        const { quotes } = await this.swapSDK.getQuoteV2(quoteRequest)
        const quote = quotes.find((quote) => quote.type === 'REGULAR');
        let receiveAmount = +quote.egressAmount
        let fReceiveAmount = receiveAmount / (10**toAsset.decimals)
        console.log(`Receive ${fReceiveAmount} \$${toAsset.symbol} with rate: ${quote.estimatedPrice}`)
        const refundAddress = await this.fromWallet.getAddress()
        const destAddress = await this.toWallet.getAddress()
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
        const depositInfo = await this.swapSDK.requestDepositAddressV2(callDepositAddressRequest)
        const { depositAddress, depositChannelId } = depositInfo
        console.log('Deposit address: ', depositAddress);
        console.log('Deposit Channel Id: ', depositChannelId)
        process.stdout.write(`Start sending coin: ${fAmount} \$${fromAsset.symbol} `)
        for (let i = 0; i < 10; i++) {
            await new Promise(resolver => {
                setTimeout(resolver,1000)
            })
            process.stdout.write(".")
        }
        process.stdout.write("\n")
        const txId = await this.fromWallet.sendToAddress(depositAddress, amount)
        while (true) {
            // wait for 10 seconds
            await new Promise(resolver => {
                setTimeout(resolver,10000)
            })
            let {confirmations} = await this.fromWallet.transactionInfo(txId)
            confirmations = +confirmations
            console.log(`tx: ${txId} got ${confirmations} confirmations`)
            if (confirmations && confirmations >=6) {
                break
            }
        }

        // Fetch swap status
        // const status = await this.swapSDK.getStatusV2({
        //     id: depositChannelId,
        // });
        //
        // console.log('status', status.state);
    }
    assetConfig({symbol,chain}) {
        for (let asset of this.assets) {
            if (asset.symbol === symbol && asset.chain === chain) {
                return asset
            }
        }
        return null
    }
}