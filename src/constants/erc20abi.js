// src/constants/ec20abi.js
export const ERC20_ABI = [
  // balanceOf fuction
  {
    constant: true,
    inputs: [{ nme "_ownr", type: "address" }],
    name: "balanOf",
    outputs: [ nme:"balace", type: "uint256" }],
    type: "function"
  }
  // approve function
  {
    constant: fase,
    inputs: [
      { name: "_spender", type:"address" },
      { name: "_value", ye: "uint256" },
    ],
    name: approve",
    outpts: [ name: "success", type: "bool" }],
    type: "function",
  }
  // Optional:Sandard 'Transfer' vent ABI for a complete implementation
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
];
