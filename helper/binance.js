import axios from "axios"

export class Binance {
    #baseUrl = "https://api.binance.com/api/v3/"
    constructor() {
    }

    // Fetch current price of a trading pair (e.g., BTCUSDT)
    async getPrice(symbol) {
        try {
            const response = await axios.get(`${this.#baseUrl}ticker/price`, {
                params: { symbol: symbol.toUpperCase() },
            });
            console.log(response.data)
            const { symbol: pair, price } = response.data;

            return { pair, price: +price, timestamp: new Date().toISOString() };
        } catch (error) {
            console.error('Error fetching price:', error.message);
            throw error;
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