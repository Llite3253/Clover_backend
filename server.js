const express = require('express');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const moment = require('moment');
const multer  = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { Web3 } = require('web3');

const app = express();
const port = 3000;
const secretKey = 'P6B`Dxw&gt;8f_jyp@5XYSQqw7cUW5jV)*a7E!Eg??({hFU79[`QefpCzAH[ng**|?b!y72mxK)+%HP5rH2[sA0%7&gt;7XZ4ytuPwFF|T';

const connection = mysql.createConnection({
    host: 'localhost', // 본인 아이피
    port: '3307', // mysql 포트
    user: 'root', // mysql 사용자 이름
    password: '', // mysql 비밀번호
    database: 'transaction' // mysql 데이터 베이스 이름
});

connection.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

console.log('Database connection state:', connection.state);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'img/') // 업로드된 파일이 저장될 폴더 경로
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname) // 파일명 설정
    }
});
  
const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'img')));

app.get('/img/:imageName', (req, res) => {
    const imageName = req.params.imageName;
    res.sendFile(path.join(__dirname, 'img', imageName));
});

app.post('/custNum_find', (req, res) => {
    const { custNum } = req.body;
    const query = 'select * from member where custNum = ?';
    connection.query(query, [custNum], (err, result) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (result.length === 0) {
            return res.status(404).send(err);
        }
        //console.log(result[0].name);
        res.status(201).json({ name: result[0].name });
    });
});

app.post('/custNum_find_wallet', async (req, res) => {
    const { custNum } = req.body;
    const wallet = await custNum_find_wallet(custNum);
    res.status(201).json({ wallet: wallet });
});

app.post('/login', async (req, res) => {
    //console.log('login');
    const { id, password  } = req.body;
    const query = 'select * from member where id = ?';
    connection.query(query, [id], async  (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length > 0) {
            const user = results[0];
            try {
                const match = await bcrypt.compare(password, user.password);
                if (match) {
                    const token = jwt.sign({ custNum: user.custNum, id: user.id, name: user.name, university: user.university, class_of: user.class_of, email: user.email }, 
                        secretKey,
                        { expiresIn: '2h' });
                    return res.json({ login_success: true, token });
                }
            } catch (e) {}
        
        }
        return res.json({ login_success: false, message: '이름 또는 비밀번호를 잘못 입력하였습니다.' });
    });
});

app.post('/register', async (req, res) => {
    //console.log('register');
    const { id, password, name, university, class_of, email, wallet } = req.body;
    image = null;
    singout = 'N';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = 'insert into member (id, password, name, university, class_of, email, image, singout, wallet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [id, hashedPassword, name, university, class_of, email, image, singout, wallet], (err, result) => {
            if (err) {
                return res.status(500).send(err);
            }
            res.status(201).json({ register_success: true });
        });
    } catch (error) {
        res.status(500).json({ register_success: false });
    }
});

app.post('/c_list', (req, res) => {
    //console.log('c_list');
    const { btype } = req.body;
    const query = 'select * from board where btype = ? order by boardKey desc';
    connection.query(query, [btype], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        results.forEach(result => {
            result.rdate = moment(result.rdate).format('YYYY-MM-DD HH:mm:ss');
        });

        res.status(201).json({ results });
    });
});

app.post('/c_view', (req, res) => {
    //console.log('c_view');
    const { boardKey } = req.body;
    const query = 'select * from board where boardKey = ? LIMIT 1';
    connection.query(query, [boardKey], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length > 0) {
            const result = results[0];
            result.rdate = moment(result.rdate).format('YYYY-MM-DD HH:mm:ss');
            res.status(201).json({ result });
        }
    });
});

app.post('/c_write', upload.single('image'), (req, res) => {
    //console.log('c_write');
    const { title, content, btype, amous, custNum } = req.body;
    const image1 = req.file ? req.file.path : null;
    const query = 'insert into board (title, content, rdate, btype, amous, image1, custNum) values (?, ?, NOW(), ?, ?, ?, ?)';
    connection.query(query, [title, content, btype, amous, image1, custNum], (err, result) => {
        if (err) {
            return res.status(500).send(err);
        }
        return res.json({ write_success: true });
    });
});

app.post('/c_update', upload.single('image'), (req, res) => {
    //console.log('c_update');
    const { title, content, amous, boardKey, image1 } = req.body;
    const uploadedImagePath  = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const imagePath = uploadedImagePath || image1;

    let query = '';

    query = 'select * from board where boardKey = ? LIMIT 1';
    connection.query(query, [boardKey], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length > 0) {
            const oldImagePath = results[0].image1;
            if(imagePath != oldImagePath && oldImagePath != null) {
                fs.unlink(oldImagePath, (err) => {
                    if (err) {
                        console.error(err);
                    }
                    //console.log('이전 이미지 삭제 성공');
                });
            }
        }
    });

    query = 'update board set title = ?, content = ?, amous = ?, image1 = ? where boardKey = ?';
    connection.query(query, [title, content, amous, imagePath, boardKey], (err, result) => {
        if (err) {
            return res.status(500).send(err);
        }
        return res.json({ update_success: true });
    });
});

app.post('/c_delete', (req, res) => {
    //console.log('c_delete');
    const { boardKey } = req.body;

    let query = '';

    query = 'select * from board where boardKey = ? LIMIT 1';
    connection.query(query, [boardKey], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length > 0) {
            const imagePath = results[0].image1;

            if (imagePath) {
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('이미지 파일 삭제 실패');
                    }
                    //console.log('이미지 파일 삭제 성공');
                });
            }

            query = 'delete from board where boardKey = ?';
            connection.query(query, [boardKey], (err, result) => {
                if (err) {
                    return res.status(500).json({ delete_success: false });
                }

                return res.status(200).json({ delete_success: true });
            });
    
        }
    })
});

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

app.get('/profile', authenticateJWT, (req, res) => {
    res.json({ user: req.user });
});

app.post('/t_list', (req, res) => {
    //console.log('t_list');
    const query = 'select * from trade ORDER BY itemKey desc';
    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        results.forEach(result => {
            result.rdate = moment(result.rdate).format('YYYY-MM-DD HH:mm:ss');
        });

        res.status(201).json({ results });
    });
});

app.post('/t_view', (req, res) => {
    //console.log('t_view');
    const { itemKey } = req.body;
    const query = 'select * from trade where itemKey = ? LIMIT 1';
    connection.query(query, [itemKey], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length > 0) {
            const result = results[0];
            result.rdate = moment(result.rdate).format('YYYY-MM-DD HH:mm:ss');
            res.status(201).json({ result });
        }
    });
});

app.post('/t_write', upload.single('image'), (req, res) => {
    //console.log('t_write');
    const { custNum, title, name, content, price, amous  } = req.body;
    const image1 = req.file ? req.file.path : null;
    const query = 'insert into trade (custNum, title, name, image1, content, price, rdate, amous) values (?, ?, ?, ?, ?, ?, NOW(), ?)';
    connection.query(query, [custNum, title, name, image1, content, price, amous], (err, result) => {
        if (err) {
            return res.status(500).send(err);
        }
        return res.json({ write_success: true });
    });
});

function custNum_find_wallet(custNum) {
    return new Promise((resolve, reject) => {
        const query = 'select * from member where custNum = ?';
        connection.query(query, [custNum], (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            if (result.length === 0) {
                resolve(null);
                return;
            }
            resolve(result[0].wallet);
        });
    });
}

app.post('/t_trade', async (req, res) => {
    const { custNum, v_custNum, price, itemKey } = req.body;
    try {
        const payerAddress = await custNum_find_wallet(custNum);
        const payeeAddress = await custNum_find_wallet(v_custNum);
        const return_makePayment = await makePayment(payerAddress, payeeAddress, price, itemKey, custNum);
        
        if (return_makePayment == 200) {
            const query = 'INSERT INTO payment (custNum, itemKey) VALUES (?, ?)';
            connection.query(query, [custNum, itemKey], (err, result) => {
                if (err) {
                    // 에러가 발생하면 한 번만 응답을 보냄
                    return res.status(500).send('Database insertion failed');
                }

                // 성공 시 한 번만 응답을 보냄
                return res.status(200).send('Payment successful');
            });
        } else {
            // Payment 실패 시 한 번만 응답을 보냄
            return res.status(500).send('Payment failed');
        }
    } catch (error) {
        console.error('Error in t_trade:', error);
        // 에러 발생 시 한 번만 응답을 보냄
        return res.status(500).send('Internal server error');
    }
});

app.post('/t_trade_sent_view', async (req, res) => {
    const { payerAddress } = req.body;
    try {
        const return_itemKeys = await viewItemKeysPayer(payerAddress);
        
        if (return_itemKeys.length > 0) {

            const query = 'select * from trade where itemKey in (?) ORDER BY itemKey desc';
            connection.query(query, [return_itemKeys], async (err, results) => {
                if (err) {
                    return res.status(500).send(err);
                }
                for (let i = 0; i < results.length; i++) {
                    results[i].rdate = moment(results[i].rdate).format('YYYY-MM-DD HH:mm:ss');
                    const payeeAddress = await custNum_find_wallet(results[i].custNum);
                    const remainingTime = await viewRemainingTime(payerAddress, payeeAddress);
                    results[i].remainingTime_days = remainingTime.days;
                    results[i].remainingTime_hours = remainingTime.hours;
                    results[i].remainingTime_minutes = remainingTime.minutes;
                    results[i].remainingTime_seconds = remainingTime.seconds;
                }

                res.status(201).json({ results });
            });
        } else {
            return res.status(500).send('Payment failed');
        }
        
    } catch (error) {
        console.error('Error in t_trade:', error);
        return res.status(500).send('Internal server error');
    }
});

app.post('/t_trade_sendPayment', async (req, res) => {
    const { custNum, payerAddress } = req.body;
    
    try {
        const payeeAddress = await custNum_find_wallet(custNum);
        const sendPaymentResult = await sendPayment(payerAddress, payeeAddress);
            
        if (sendPaymentResult.success) {
            res.status(200).json(sendPaymentResult.result);
        } else {
            res.status(500).json({ error: sendPaymentResult.error });
        }
    } catch (error) {
        res.status(501);
    }
});

app.post('/t_trade_received_view', async (req, res) => {
    const { payeeAddress } = req.body;
    try {
        // 수취인의 모든 itemKeys 조회
        const return_itemKeys = await viewItemKeysPayee(payeeAddress);

        if (return_itemKeys.length > 0) {
            // 결과를 저장할 배열
            let aggregatedResults = [];

            // 각 itemKey에 대해 반복
            for (let i = 0; i < return_itemKeys.length; i++) {
                const itemKey = return_itemKeys[i];
                const query = 'SELECT * FROM trade WHERE itemKey = ? ORDER BY itemKey DESC';

                // 각 itemKey에 대한 쿼리 실행
                const results = await new Promise((resolve, reject) => {
                    connection.query(query, itemKey, async (err, dbResults) => {
                        if (err) {
                            reject(err);
                        } else {
                            try {
                                // viewCustNumsPayee 함수에서 수취인과 관련된 모든 고객 번호를 조회
                                const viewCustNums = await viewCustNumsPayee(payeeAddress);

                                for (let k = 0; k < dbResults.length; k++) {
                                    // 각 고객 번호에 대한 지갑 주소와 remainingTime을 조회
                                    const payerAddress = await custNum_find_wallet(viewCustNums[k]);
                                    const remainingTime = await viewRemainingTime(payerAddress, payeeAddress);

                                    // 날짜와 remainingTime을 적절한 형식으로 변환하여 dbResults에 추가
                                    dbResults[k].rdate = moment(dbResults[k].rdate).format('YYYY-MM-DD HH:mm:ss');
                                    dbResults[k].sendCustNum = viewCustNums[k];
                                    dbResults[k].remainingTime_days = remainingTime.days;
                                    dbResults[k].remainingTime_hours = remainingTime.hours;
                                    dbResults[k].remainingTime_minutes = remainingTime.minutes;
                                    dbResults[k].remainingTime_seconds = remainingTime.seconds;

                                    // BigInt 타입의 필드를 문자열로 변환
                                    for (const field in dbResults[k]) {
                                        if (typeof dbResults[k][field] === 'bigint') {
                                            dbResults[k][field] = dbResults[k][field].toString();
                                        }
                                    }
                                }
                                resolve(dbResults);
                            } catch (error) {
                                reject(error);
                            }
                        }
                    });
                });

                // 각 itemKey의 결과를 aggregatedResults에 추가
                aggregatedResults = aggregatedResults.concat(results);
            }

            // 최종 결과를 클라이언트에 전송
            res.status(201).json({ results: aggregatedResults });
        } else {
            return res.status(500).send('No items found for the specified payee address.');
        }

    } catch (error) {
        console.error('Error in t_trade_received_view:', error);
        return res.status(500).send('Internal server error');
    }
});

app.post('/t_trade_receivedPayment', async (req, res) => {
    const { custNum, payeeAddress } = req.body;
    try {
        const payerAddress = await custNum_find_wallet(custNum);
        const result = await contract.methods.receivePayment(payerAddress, payeeAddress).send({
            from: payeeAddress, // 수취인이 직접 트랜잭션을 발생시킴
            gas: 200000,
        });

        if (result.status) {
            res.status(200).json({ message: 'Payment received successfully.' });
        } else {
            res.status(500).json({ error: 'Failed to receive payment.' });
        }
    } catch (error) {
        //console.error('Full error object:', JSON.stringify(error, null, 2));
    
        // 기본 오류 메시지 확인
        let errorMessage = error.message || '';
    
        // 중첩된 오류 메시지 확인
        if (error.cause && error.cause.message) {
            errorMessage = error.cause.message;
        } else if (error.innerError && error.innerError.message) {
            errorMessage = error.innerError.message;
        }
    
        //console.log('Extracted error message:', errorMessage);
    
        // 오류 메시지에 "Payment is on hold"가 있는지 확인
        if (errorMessage.includes('Payment is on hold')) {
            res.status(400).json({ message: 'Payment is on hold' });
        } else if (errorMessage.includes('Hold period not over yet')) {
            res.status(401).json({ message: 'Hold period not over yet' });
        } else if (errorMessage.includes('No pending payment')) {
            res.status(402).json({ message: 'No pending payment' });
        } else {
            res.status(500).json({ message: 'error' });
        }
    }
});

app.post('/viewCustNumsPayee', async (req, res) => {
    const { payeeAddress } = req.body;
    try {
        const viewCustNums = await viewCustNumsPayee(payeeAddress);

        if (viewCustNums.length > 0) {
            res.status(200).json(viewCustNums);
        } else {
            res.status(500).json({ error: viewCustNums.error });
        }
    } catch (error) {
        res.status(501).json({ message: 'error' });
    }
});

app.post('/holdPayment', async (req, res) => {
    const { custNum, payerAddress } = req.body;

    try {
        const payeeAddress = await custNum_find_wallet(custNum);
        const result = await contract.methods.reportAndHoldPayment(payerAddress, payeeAddress).send({
            from: payerAddress,
            gas: 200000,
        });

        res.json({ result: 'Payment held successfully' });
    } catch (error) {
        //console.error('Full error object:', JSON.stringify(error, null, 2));
    
        // 기본 오류 메시지 확인
        let errorMessage = error.message || '';
    
        // 중첩된 오류 메시지 확인
        if (error.cause && error.cause.message) {
            errorMessage = error.cause.message;
        } else if (error.innerError && error.innerError.message) {
            errorMessage = error.innerError.message;
        }
    
        //console.log('Extracted error message:', errorMessage);
    
        // 오류 메시지에 "Payment is on hold"가 있는지 확인
        if (errorMessage.includes('Payment is on hold')) {
            res.status(400).json({ message: 'Payment is on hold' });
        } else if (errorMessage.includes('No pending payment')) {
            res.status(401).json({ message: 'No pending payment' });
        } else {
            res.status(500).json({ message: 'error' });
        }
    }
});

app.post('/report_list', async (req, res) => {
    try {
        // 모든 보류된 거래 조회
        const heldPayments = await contract.methods.viewAllHeldPayments().call();
        
        // 각 거래에 대한 자세한 정보를 조회
        let detailedHeldPayments = [];
        for (let paymentInfo of heldPayments) {
            const paymentDetails = await contract.methods.viewPaymentDetails(paymentInfo.payer, paymentInfo.payee).call();

            // BigInt 값을 문자열로 변환
            detailedHeldPayments.push({
                payer: paymentInfo.payer,
                payee: paymentInfo.payee,
                amount: paymentDetails[0].toString(), // BigInt를 문자열로 변환
                isHeld: paymentDetails[3],
                custNum: paymentDetails[4].toString(), // BigInt를 문자열로 변환
                itemKey: paymentDetails[5] // itemKey 추가
            });
        }

        // 보류된 모든 거래 목록을 클라이언트에 전송
        res.status(200).json({ heldPayments: detailedHeldPayments });
    } catch (error) {
        console.error('Error viewing held payments:', error);
        res.status(500).json({ error: 'Error viewing held payments', details: error.message });
    }
});

app.post('/cancelPayment', async (req, res) => {
    const { payerAddress, payeeAddress } = req.body;

    try {
        await contract.methods.cancelPayment(payerAddress, payeeAddress).send({
            from: payerAddress,
            gas: 200000,
        });
        
        // 성공적으로 취소되었음을 응답
        res.status(200).json({ message: 'Payment cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling payment:', error);
        res.status(500).json({ error: 'Error cancelling payment' });
    }
});

app.post('/forceTransferPayment', async (req, res) => {
    const { payerAddress, payeeAddress } = req.body;

    try {
        await contract.methods.forceTransferPayment(payerAddress, payeeAddress).send({
            from: payerAddress,
            gas: 200000,
        });
        
        // 성공적으로 취소되었음을 응답
        res.status(200).json({ message: 'Payment cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling payment:', error);
        res.status(500).json({ error: 'Error cancelling payment' });
    }
});

app.post('/viewAllHeldPayments', async (req, res) => {
    const { walletAddress } = req.body;

    try {
        // 보류된 거래 조회를 위해 스마트 컨트랙트 호출
        const heldPayments = await contract.methods.viewAllHeldPaymentsByWallet(walletAddress).call();

        // 각 거래에 대한 자세한 정보를 조회
        let detailedHeldPayments = [];
        for (let paymentInfo of heldPayments) {
            const paymentDetails = await contract.methods.viewPaymentDetails(paymentInfo.payer, paymentInfo.payee).call();

            // 결과를 추가할 때 BigInt 값을 문자열로 변환
            detailedHeldPayments.push({
                amount: paymentDetails[0].toString(), // BigInt -> 문자열로 변환
                isHeld: paymentDetails[3],
                custNum: paymentDetails[4].toString(), // BigInt -> 문자열로 변환
                itemKey: paymentDetails[5] // itemKey 추가
            });
        }

        // 모든 보류된 거래 정보를 클라이언트에 전송
        res.status(200).json({ heldPayments: detailedHeldPayments });
    } catch (error) {
        console.error('Error viewing held payments:', error);
        res.status(500).json({ error: 'Error viewing held payments', details: error.message });
    }
});

/* ------------------- 블록체인 ------------------- */

const web3 = new Web3('http://127.0.0.1:7545'); // 가나쉬 주소

// ABI 파일 경로
const abiFilePath = 'abi/PaymentHold.json';
// 스마트 컨트렉트 주소
const contractAddress = '0x9f053148de713C395b416bCFBc6e22Bb8AEb3A87';

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

const abi = extractAbiFromFile(abiFilePath);

const contract = new web3.eth.Contract(abi, contractAddress);

async function makePayment(fromAddress, payeeAddress, amount, itemKey, custNum) {
    //console.log('makePayment');
    try {
        const value = web3.utils.toWei(amount, 'ether');

        // 올바른 이더리움 주소인지 확인
        if (!web3.utils.isAddress(payeeAddress)) {
            console.error('Invalid Ethereum address');
            return 500;
        }

        const result = await contract.methods.makePayment(payeeAddress, itemKey, custNum).send({
            from: fromAddress,
            value: value,
            gas: 400000,
        });

        // 성공적으로 전송된 경우
        const jsonResponse = JSON.parse(JSON.stringify(result, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        //console.log('Payment successful:', jsonResponse);
        return 200;
    } catch (error) {
        console.error('Error making payment:', error);
        return 500;
    }
}

// app.get('/releasePayment', async (req, res) => {
//     try {
//         const accounts = await web3.eth.getAccounts();
//         const result = await contract.methods.releasePayment().send({
//             from: accounts[0],
//             gas: 60000,
//         });

//         res.json({ result });
//     } catch (error) {
//         console.error('Error releasing payment:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

async function sendPayment(fromAddress, payeeAddress) {
    try {
      const pendingAmount = await contract.methods.viewPendingPayment(fromAddress, payeeAddress).call();
      if (pendingAmount <= 0) {
        throw new Error('No pending payment');
      }
  
      const result = await contract.methods.sendPayment(payeeAddress).send({
        from: fromAddress,
        gas: 200000,
      });
  
      const jsonResponse = JSON.parse(JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
  
      return { success: true, result: jsonResponse };
    } catch (error) {
      return { success: false };
    }
  }

app.post('/cancelPayment', async (req, res) => {
    try {
        const { fromAddress, payeeAddress } = req.body;

        const result = await contract.methods.cancelPayment(payeeAddress).send({
            from: fromAddress,
            gas: 200000,
        });

        const jsonResponse = JSON.parse(JSON.stringify(result, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        res.json({ result: jsonResponse });
    } catch (error) {
        console.error('Error cancelling payment:', error);
        res.status(500).json({ error: 'Error cancelling payment', details: error.message });
    }
});

async function receivePayment(payerAddress, payeeAddress) {
    try {
        //const { payerAddress, payeeAddress } = req.body;
        
        // 스마트 계약으로부터 지불을 수령하는 함수 호출
        const result = await contract.methods.receivePayment(payerAddress, payeeAddress).send({
            from: payerAddress,
            gas: 200000,
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
}

async function viewPendingPayment(payerAddress, payeeAddress) {
    try {
        const result = await contract.methods.viewPendingPayment(payerAddress, payeeAddress).call();
        const etherValue = web3.utils.fromWei(result.toString(), 'ether');
        const formattedResult = {
            amount: etherValue.toString()
        };
        
        return formattedResult;
    } catch(e) {
        return 0;
    }
}

async function viewPaymentTimestamp(payerAddress, payeeAddress) {
    try {
        const result = await contract.methods.viewPaymentTimestamp(payerAddress, payeeAddress).call();
        const timestampInSeconds = result.toString();
        const offset = 9 * 60 * 60 * 1000; // 9시간의 밀리초 오프셋 (한국 표준시, GMT+9)
        const date = new Date((timestampInSeconds * 1000) + offset);

        return date;
    } catch(e) {
        return 0;
    }
}

async function viewRemainingTime(payerAddress, payeeAddress) {
    try {
        const result = await contract.methods.viewPaymentTimestamp(payerAddress, payeeAddress).call();
        const paymentTime = result.toString();
        const holdPeriodRaw = await contract.methods.holdPeriod().call();
        const holdPeriod = parseInt(holdPeriodRaw);

        const currentTime = Math.floor(Date.now() / 1000);
        const elapsedTime = currentTime - paymentTime;
        const remainingTimeInSeconds  = Math.max(holdPeriod - elapsedTime, 0);

        const remainingTime = {
            days: Math.floor(remainingTimeInSeconds / (60 * 60 * 24)),
            hours: Math.floor((remainingTimeInSeconds % (60 * 60 * 24)) / (60 * 60)),
            minutes: Math.floor((remainingTimeInSeconds % (60 * 60)) / 60),
            seconds: remainingTimeInSeconds % 60
        };

        //console.log(remainingTimeInSeconds);

        return remainingTime;
    } catch(e) {
        return 0;
    }
}

app.post('/getViewPayment', async (req, res) => {
    try {
        const { payerAddress, payeeAddress } = req.body;
        const viewPendingPaymentResult = await viewPendingPayment(payerAddress, payeeAddress);
        const viewPaymentTimestampResult = await viewPaymentTimestamp(payerAddress, payeeAddress);
        const viewRemainingTimeResult = await viewRemainingTime(payerAddress, payeeAddress);

        res.json({ viewPendingPayment: viewPendingPaymentResult, viewPaymentTimestamp: viewPaymentTimestampResult
            , viewRemainingTime: viewRemainingTimeResult });
    } catch (error) {
        console.log('error');
    }
});

app.post('/getBalance', async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        const balance = await web3.eth.getBalance(ethereumAddress);
        const etherBalance = web3.utils.fromWei(balance, 'ether');

        res.json({ balance: etherBalance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error occurred while fetching balance' });
    }
});

app.post('/viewTotalPaymentsByPayer', async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        const etherValue = await contract.methods.viewTotalPendingPaymentsSentByPayer(ethereumAddress).call();
        const ether = web3.utils.fromWei(etherValue, 'ether');
        
        res.json({ ether: ether });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error occurred while fetching balance' });
    }
});

app.post('/viewPaymentsByPayee', async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        // 유효한 Ethereum 주소인지 확인

        if (!web3.utils.isAddress(ethereumAddress)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        // 스마트 계약에서 결제 금액 조회
        const etherValue = await contract.methods.viewPaymentsByPayee(ethereumAddress).call();
        // Wei 단위를 Ether로 변환
        const ether = web3.utils.fromWei(etherValue, 'ether');
        
        // 응답 반환
        res.json({ ether: ether });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error occurred while fetching balance' });
    }
});

app.post('/viewCompletedPaymentsByPayee', async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        const etherValue = await contract.methods.viewCompletedPaymentsByPayee(ethereumAddress).call();
        const ether = web3.utils.fromWei(etherValue, 'ether');
        
        //console.log(ether);
        res.json({ ether: ether });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error occurred while fetching balance' });
    }
});

app.post('/viewItemKeysPayee', async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        const value = await contract.methods.viewItemKeysPayee(ethereumAddress).call();
        //const value2 = await contract.methods.viewItemKeysPayer(ethereumAddress).call();
        
        //console.log(value, value2);
        res.json({ value: value });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error occurred while fetching balance' });
    }
});

async function viewItemKeysPayer(payerAddress) {
    const value = await contract.methods.viewItemKeysPayer(payerAddress).call();
    //console.log(value);
    return value;
}

async function viewItemKeysPayee(payeeAddress) {
    const value = await contract.methods.viewItemKeysPayee(payeeAddress).call();
    //console.log(value);
    return value;
}

async function viewCustNumsPayee(payeeAddress) {
    const value = await contract.methods.viewCustNumsPayee(payeeAddress).call();
    //console.log(value);
    return value;
}

/* ------------------- 블록체인 ------------------- */

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});