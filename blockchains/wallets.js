import {Bitcoind} from "./bitcoind/bitcoind.js";
import {Geth} from "./geth/geth.js";
import {Solana} from "./solana/solana.js";

export async function newWallet (isTest, network, cfg) {
    switch (network.chain.toLocaleLowerCase()) {
        case "bitcoin":
            return new Bitcoind(network, isTest, cfg)
        case "ethereum":
            return await Geth.fromFilePath(network,isTest, cfg.path, cfg.password)
        case "solana":
            return await Solana.fromFilePath(network,isTest, cfg.path)
    }
    throw new Error(`${network.chain} is not supported yet`)
}