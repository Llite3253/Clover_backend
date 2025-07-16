const express = require('express');
const { Web3 } = require('web3');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');
const port = 3000;

// Web3 설정 (Ganache 사용)
const web3 = new Web3('http://127.0.0.1:7545'); // Ganache RPC URL

// ABI 파일 경로
const abiFilePath = 'abi/PaymentHold.json';
const contractAddress = '0xdAF4c584a534102d1ab7CFd0E29919C6f09D8432';

function extractAbiFromFile(filePath) {
  try {
    const jsonData = fs.readFileSync(filePath);
    const abi = JSON.parse(jsonData).abi;

    return abi;
  } catch (error) {
    console.error('JSON 파일에서 ABI를 추출하는 중 에러 발생:', error);
    return null;
  }
}

app.use(bodyParser.json());

// ABI 추출
const abi = extractAbiFromFile(abiFilePath);

// 스마트 컨트랙트 인스턴스 생성
const contract = new web3.eth.Contract(abi, contractAddress);

// API 엔드포인트 정의
app.post('/makePayment', async (req, res) => {
  try {
    const { fromAddress, payeeAddress, amount } = req.body;
    const value = web3.utils.toWei(amount, 'ether');

    // 올바른 이더리움 주소인지 확인
    if (!web3.utils.isAddress(payeeAddress)) { 
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const result = await contract.methods.makePayment(payeeAddress).send({
      from: fromAddress, // 첫 번째 계정 사용
      value: value,
      gas: 200000,
    });

    const jsonResponse = JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    res.json({ result: jsonResponse });
  } catch (error) {
    console.error('Error making payment:', error);
    res.status(500).json({ error: 'Error making payment', details: error.message });
  }

});

app.get('/releasePayment', async (req, res) => {
    try {
        const accounts = await web3.eth.getAccounts();
        const result = await contract.methods.releasePayment().send({
            from: accounts[0], // 첫 번째 계정을 사용
            gas: 60000,
        });

        res.json({ result });
    } catch (error) {
        console.error('Error releasing payment:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/completePayment', async (req, res) => {
  try {
      const { fromAddress, payeeAddress } = req.body;
      
      // 이 부분에서 보류 중인 결제가 있는지 확인
      const pendingAmount = await contract.methods.pendingPayments(payeeAddress).call();
      if (pendingAmount <= 0) {
          throw new Error('No pending payment');
      }

      const accounts = await web3.eth.getAccounts();
      const result = await contract.methods.completePayment(payeeAddress).send({
          from: fromAddress, // 첫 번째 계정을 사용
          gas: 200000,
      });

      const jsonResponse = JSON.parse(JSON.stringify(result, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
      ));
  
      res.json({ result: jsonResponse });
  } catch (error) {
      console.error('Error completing payment:', error);
      res.status(500).json({ error: error.message });
  }
});

app.get('/cancelPayment/:payee', async (req, res) => {
    try {
        const payee = req.params.payee;
        const accounts = await web3.eth.getAccounts();
        const result = await contract.methods.cancelPayment(payee).send({
            from: accounts[0], // 첫 번째 계정을 사용
            gas: 60000,
        });

        res.json({ result });
    } catch (error) {
        console.error('Error cancelling payment:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/viewPendingPayment/:payee', async (req, res) => {
    try {
        const payee = req.params.payee;
        const result = await contract.methods.viewPendingPayment(payee).call();
        res.json({ result });
    } catch (error) {
        console.error('Error viewing pending payment:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/viewPaymentTimestamp/:payee', async (req, res) => {
    try {
        const payee = req.params.payee;
        const result = await contract.methods.viewPaymentTimestamp(payee).call();
        res.json({ result });
    } catch (error) {
        console.error('Error viewing payment timestamp:', error);
        res.status(500).json({ error: error.message });
    }
});

// 서버 시작
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});