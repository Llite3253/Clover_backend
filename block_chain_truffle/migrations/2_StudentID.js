const StudentID = artifacts.require("./StudentID");

module.exports = function (deployer) {
  deployer.deploy(StudentID);
};