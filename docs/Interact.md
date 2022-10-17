Interact with contracts

## Deploy faucet token

For local devnet or testnet,  you could use this command to deploy some erc20 tokens. You could add `--from-transfer-fee-ratio` or `--to-transfer-fee-ratio` to set the fee ratio taken when transfer to monitor non-standard erc20 token.

```bash
NET=LOCAL1 npx hardhat deployFaucetToken --help

Hardhat version 2.10.1

Usage: hardhat [GLOBAL OPTIONS] deployFaucetToken [--decimals <INT>] [--from-transfer-fee-ratio <INT>] --name <STRING> --symbol <STRING> [--to-transfer-fee-ratio <INT>]

OPTIONS:

  --decimals                    The token decimals (default: 18)
  --from-transfer-fee-ratio     The fee ratio taken of from address when transfer (default: 0)
  --name                        The token name 
  --symbol                      The token symbol 
  --to-transfer-fee-ratio       The fee ratio taken of to address when transfer (default: 0)

deployFaucetToken: Deploy faucet token for testnet
```

