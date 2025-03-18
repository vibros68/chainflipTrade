import {Bitcoind} from "./bitcoind/bitcoind.js";
import {Geth} from "./geth/geth.js";

export function newWallet({symbol, chain, cfg}) {
    switch (chain.toLocaleLowerCase()) {
        case "bitcoin":
            return new Bitcoind(cfg)
        case "ethereum":
            return new Geth(cfg)
    }
    throw new Error(`${chain} is not supported yet`)
}