const PaymentHold = artifacts.require("./PaymentHold");

module.exports = function (deployer) {
  deployer.deploy(PaymentHold);
};