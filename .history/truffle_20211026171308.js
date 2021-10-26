var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "table sudden sleep motor purpose breeze injury bomb satisfy nature planet reveal";

module.exports = {
  networks: {
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: '*',
      gas: 6700000
    }
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};