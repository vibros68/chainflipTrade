// Abstract class acting as an interface
export class WalletInterface {
    constructor() {
        if (this.constructor === WalletInterface) {
            throw new Error("Cannot instantiate abstract class");
        }
        // Check if required methods are implemented
        this.ensureImplements();
    }

    // Placeholder methods (to be implemented by subclasses)
    async getBalance() {
        throw new Error("Method 'getBalance()' must be implemented");
    }

    async sendToAddress() {
        throw new Error("Method 'sendToAddress()' must be implemented");
    }

    async getAddress() {
        throw new Error("Method 'getAddress()' must be implemented");
    }

    async transactionInfo() {
        throw new Error("Method 'transactionInfo()' must be implemented");
    }

    // Ensure all required methods are implemented
    ensureImplements() {
        const requiredMethods = ['getBalance', 'getAddress', 'sendToAddress', 'transactionInfo'];
        requiredMethods.forEach(method => {
            if (typeof this[method] !== 'function') {
                throw new Error(`Method '${method}' must be implemented`);
            }
        });
    }
}