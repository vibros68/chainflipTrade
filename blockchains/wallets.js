import {Bitcoind} from "./bitcoind/bitcoind.js";
import {Geth} from "./geth/geth.js";
import {Solana} from "./solana/solana.js";

export async function newWallet ({symbol, chain, cfg}) {
    switch (chain.toLocaleLowerCase()) {
        case "bitcoin":
            return new Bitcoind(cfg)
        case "ethereum":
            return new Geth(cfg)
        case "solana":
            const {isTest, path} = cfg
            return Solana.fromFilePath(isTest, path)
    }
    throw new Error(`${chain} is not supported yet`)
}