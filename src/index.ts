import {
  ChainId,
  Fetcher,
  Token,
  WETH,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  Percent,
} from "@uniswap/sdk";
import * as ethers from "ethers";
import { infuraUrl, PRIVATE_KEY } from "./config";

const chainId = ChainId.MAINNET;
const tokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

const init = async () => {
  const DAI: Token = await Fetcher.fetchTokenData(chainId, tokenAddress);
  const weth = WETH[chainId];

  const pair = await Fetcher.fetchPairData(DAI, weth);
  const route = new Route([pair], weth);

  // getting to 6 significant digit - theoretical price
  console.log(`Current market rates`);
  console.log(`Current DAI per ETH: ${route.midPrice.toSignificant(6)}`);
  console.log(
    `Current ETH per DAI: ${route.midPrice.invert().toSignificant(6)}`
  );

  const inputAmountWeth = "100000000000000000000"; // 100 WETH

  const trade = new Trade(
    route,
    new TokenAmount(weth, inputAmountWeth),
    TradeType.EXACT_INPUT
  );

  console.log(trade.executionPrice.toSignificant(6));
  console.log(trade.nextMidPrice.toSignificant(6));

  // https://github.com/Uniswap/uniswap-v2-periphery/blob/4123f93278b60bcf617130629c69d4016f9e7584/contracts/UniswapV2Router02.sol#L252
  //     function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)

  const slippageTolerance = new Percent("50", "10000"); // 0.5%
  const amountOutputMin = trade.minimumAmountOut(slippageTolerance).raw;
  const path = [weth.address, DAI.address];

  const recipient = ""; // recipient's checksummed adress
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const value = trade.inputAmount.raw;

  // use an infuraUrl as the ethereum node
  const provider = ethers.getDefaultProvider("mainnet", {
    infura: infuraUrl,
  });

  const signer = new ethers.Wallet(PRIVATE_KEY);
  const account = signer.connect(provider);
  const uniswap = new ethers.Contract(
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    [
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);",
    ],
    account
  );

  // perform sawp exactETHforTokens
  const tx = await uniswap.sendExactETHForTokens(
    amountOutputMin,
    path,
    recipient,
    deadline,
    { value, gasPrice: 20e9 }
  );
  console.log(`Transation hash ${tx.hash}`);

  // track to ensure transaction gets mined into block
  const txnReceipt = await tx.wait();
  console.log(`Transaction was mined in block ${txnReceipt.blockNumber}`);
};

init();
