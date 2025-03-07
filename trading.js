import { SwapSDK } from "@chainflip/sdk/swap";

export class Trading {
    swapSDK = null;
    assets = [];
    from = {};
    to = {};
    order = {}
    constructor({isTest, from, to, order}) {
        const swapConfig = {
            network: "perseverance", // Testnet
            backendUrl: "https://chainflip-swap-perseverance.chainflip.io",
            //signer: Wallet.fromPhrase(process.env.WALLET_MNEMONIC_PHRASE),
            broker: {
                //url: 'https://my.broker.io',
                commissionBps: 0, // basis points, i.e. 100 = 1%
            },
        };
        this.swapSDK = new SwapSDK(swapConfig);
        this.from = from
        this.to = to
        this.order = order
    }
    async init() {
        this.assets = await this.swapSDK.getAssets();
    }
    async run() {
        console.log(this.assets)
        await this.makeOrder()
    }
    async makeOrder() {
        let fAmount = Math.random() * (this.order.max - this.order.min) + this.order.min;
        let fromAsset = this.assetConfig(this.from)
        let toAsset = this.assetConfig(this.to)
        let amount = Math.floor(fAmount*(10**fromAsset.decimals))
        console.log(`making an order with amount: ${fAmount}`)
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
        console.log(await this.swapSDK.getQuoteV2(quoteRequest));
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