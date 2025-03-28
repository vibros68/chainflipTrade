import axios from "axios"

export class Binance {
    #baseUrl = "https://api.binance.com/api/v3/"
    constructor() {
    }

    async #tiker(symbol) {
        const response = await axios.get(`${this.#baseUrl}ticker/price`, {
            params: { symbol: symbol.toUpperCase() },
        });
        const { price } = response.data;
        console.log(price)
        return +price
    }

    // Fetch current price of a trading pair (e.g., BTCUSDT)
    async getPrice({from,to}) {
        from = from.toUpperCase()
        to = to.toUpperCase()
        const symbol = from+to
        try {
            if (from === "USDT") {
                if (to === "USDT") {
                    return 1
                }
                let price = await this.#tiker(to+from)
                return 1/ +price
            }
            if (to === "USDT") {
                return await this.#tiker(from+to)
            }
            const fromTicker = await this.#tiker(from+"USDT")
            const toTicker = await this.#tiker(to+"USDT")
            return fromTicker/toTicker
        } catch (error) {
            throw new Error(`Error fetching price for ${symbol}: ${error.message}`);
        }
    }

    // Fetch prices for multiple symbols
    async getMultiplePrices(symbols) {
        try {
            const promises = symbols.map(symbol => this.getPrice(symbol));
            return await Promise.all(promises);
        } catch (error) {
            console.error('Error fetching multiple prices:', error.message);
            throw error;
        }
    }
}