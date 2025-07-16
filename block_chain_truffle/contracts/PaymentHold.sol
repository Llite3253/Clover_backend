// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract PaymentHold {
    struct Payment {
        uint amount;
        uint timestamp;
        bool sentByPayer;
        uint custNum;
        bool isHeld; // 보류 상태
    }

    struct PayeeInfo {
        address payer;
        address payee;
    }
    
    mapping(address => mapping(address => Payment)) public payments; // 지불자에서 수취인으로의 결제 정보 저장
    mapping(address => uint) public totalpaymentsByPayee;
    mapping(address => uint) public totalPaymentsByPayer;
    mapping(address => PayeeInfo[]) public payeesByPayer;
    mapping(address => address[]) public paymentsByPayee;
    mapping(address => mapping(address => string[])) public itemKeys;
    mapping(address => mapping(address => uint[])) public custNums;

    address[] public allPayers; // 모든 지불자 목록 저장

    //uint public constant holdPeriod = 7 days; // 결제 보류 기간 설정 (예: 7일)
    uint public constant holdPeriod = 30 seconds;

    //mapping(bytes32 => bool) private seenKeys; // 중복을 체크하기 위한 storage 변수

    event PaymentInitiated(address indexed payer, address indexed payee, uint amount, string itemKey, uint custNum);
    event PaymentSent(address indexed payer, address indexed payee, uint amount);
    event PaymentCompleted(address indexed payer, address indexed payee, uint amount);
    event PaymentHeld(address indexed payer, address indexed payee); // 보류 상태 설정 이벤트
    event PaymentReleased(address indexed payer, address indexed payee); // 보류 해제 이벤트

    // 지불자가 수취인에게 돈을 전송하고 결제를 초기화하는 함수
    function makePayment(address _payee, string memory _itemKey, uint _custNum) external payable {
        require(msg.value > 0, "Payment amount must be greater than 0");

        if (payeesByPayer[msg.sender].length == 0) {
            allPayers.push(msg.sender); // 새로운 지불자가 결제를 시작할 때 allPayers에 추가
        }

        payments[msg.sender][_payee] = Payment({
            amount: msg.value,
            timestamp: block.timestamp,
            sentByPayer: false,
            custNum: _custNum,
            isHeld: false
        });

        payeesByPayer[msg.sender].push(PayeeInfo({payer: msg.sender, payee: _payee}));
        paymentsByPayee[_payee].push(msg.sender);
        totalPaymentsByPayer[msg.sender] += msg.value;
        totalpaymentsByPayee[_payee] += msg.value;
        itemKeys[msg.sender][_payee].push(_itemKey);
        custNums[msg.sender][_payee].push(_custNum);

        emit PaymentInitiated(msg.sender, _payee, msg.value, _itemKey, _custNum);
    }

    // 사용자가 거래를 보류하도록 신고하는 함수
    function reportAndHoldPayment(address _payer, address _payee) external {
        Payment storage payment = payments[_payer][_payee];
        require(payment.amount > 0, "No pending payment");
        require(msg.sender == _payer || msg.sender == _payee, "Only payer or payee can report");
        require(!payment.isHeld, "Payment is already on hold");

        payment.isHeld = true; // 보류 상태 설정
        emit PaymentHeld(_payer, _payee);
    }

    // // 보류 상태를 관리자가 해제하는 함수 (관리자만 호출 가능)
    // function releasePayment(address _payer, address _payee) external onlyAdmin {
    //     Payment storage payment = payments[_payer][_payee];
    //     require(payment.isHeld, "Payment is not on hold");
    //     payment.isHeld = false; // 보류 상태 해제
    //     emit PaymentReleased(_payer, _payee);
    // }

    // 특정 거래의 자세한 내용을 반환하는 함수
    function viewPaymentDetails(address _payer, address _payee) external view returns (uint, uint, bool, bool, uint, string memory) {
    Payment memory payment = payments[_payer][_payee];
    require(payment.amount > 0, "No payment found");

    // itemKey 추가 (payee에 대한 payer의 itemKeys 배열의 마지막 값을 가져옴)
    string memory itemKey = itemKeys[_payer][_payee][itemKeys[_payer][_payee].length - 1];

    return (payment.amount, payment.timestamp, payment.sentByPayer, payment.isHeld, payment.custNum, itemKey);
}

    // 보류된 모든 거래 목록을 확인하는 함수 (모든 사용자가 볼 수 있도록)
    function viewAllHeldPayments() external view returns (PayeeInfo[] memory) {
        uint heldCount = 0;

        // 보류된 거래의 개수 확인
        for (uint i = 0; i < allPayers.length; i++) {
            address payer = allPayers[i];
            PayeeInfo[] storage payeeInfos = payeesByPayer[payer];
            
            for (uint j = 0; j < payeeInfos.length; j++) {
                Payment memory payment = payments[payeeInfos[j].payer][payeeInfos[j].payee];
                if (payment.isHeld) {
                    heldCount++;
                }
            }
        }

        PayeeInfo[] memory heldPayments = new PayeeInfo[](heldCount);
        uint index = 0;

        // 보류된 거래 저장
        for (uint i = 0; i < allPayers.length; i++) {
            address payer = allPayers[i];
            PayeeInfo[] storage payeeInfos = payeesByPayer[payer];
            
            for (uint j = 0; j < payeeInfos.length; j++) {
                Payment memory payment = payments[payeeInfos[j].payer][payeeInfos[j].payee];
                if (payment.isHeld) {
                    heldPayments[index] = payeeInfos[j];
                    index++;
                }
            }
        }

        return heldPayments;
    }

    // 지갑 주소를 사용해서 모든 보류된 거래를 조회하는 함수
    function viewAllHeldPaymentsByWallet(address wallet) external view returns (PayeeInfo[] memory) {
        uint heldCount = 0;

        // 구매자일 때 보류된 거래의 개수 확인
        for (uint i = 0; i < payeesByPayer[wallet].length; i++) {
            if (payments[wallet][payeesByPayer[wallet][i].payee].isHeld) {
                heldCount++;
            }
        }

        // 판매자일 때 보류된 거래의 개수 확인
        for (uint i = 0; i < paymentsByPayee[wallet].length; i++) {
            if (payments[paymentsByPayee[wallet][i]][wallet].isHeld) {
                heldCount++;
            }
        }

        PayeeInfo[] memory heldPayments = new PayeeInfo[](heldCount);
        uint index = 0;

        // 구매자일 때 보류된 거래 저장
        for (uint i = 0; i < payeesByPayer[wallet].length; i++) {
            Payment memory payment = payments[wallet][payeesByPayer[wallet][i].payee];
            if (payment.isHeld) {
                heldPayments[index] = payeesByPayer[wallet][i];
                index++;
            }
        }

        // 판매자일 때 보류된 거래 저장
        for (uint i = 0; i < paymentsByPayee[wallet].length; i++) {
            Payment memory payment = payments[paymentsByPayee[wallet][i]][wallet];
            if (payment.isHeld) {
                heldPayments[index] = PayeeInfo(paymentsByPayee[wallet][i], wallet);
                index++;
            }
        }
        return heldPayments;
    }

    // 보류된 거래를 취소하고 지불자에게 금액 반환
    function cancelPayment(address _payer, address _payee) external {
        Payment storage payment = payments[_payer][_payee];
        require(payment.amount > 0, "No pending payment");
        require(payment.isHeld, "Payment is not on hold");
        require(msg.sender == _payer, "Only payer can cancel the payment");

        uint amount = payment.amount;
        payment.amount = 0; // 금액 초기화
        payment.isHeld = false; // 보류 상태 해제

        payable(_payer).transfer(amount); // 금액 반환
    }

    // 관리자가 보류된 거래를 강제로 전송 (강제 전송)
    function forceTransferPayment(address _payer, address _payee) external {
        Payment storage payment = payments[_payer][_payee];
        require(payment.amount > 0, "No pending payment");
        require(payment.isHeld, "Payment is not on hold");

        uint amount = payment.amount;
        payment.amount = 0; // 금액 초기화
        payment.isHeld = false; // 보류 상태 해제

        payable(_payee).transfer(amount); // 금액 전송
    }

    // 지불자가 수취인에게 돈을 보내는 함수
    function sendPayment(address _payee) external {
        Payment storage payment = payments[msg.sender][_payee];
        require(payment.amount > 0, "No pending payment");
        require(block.timestamp < payment.timestamp + holdPeriod, "Hold period over");

        uint amount = payment.amount;
        payment.amount = 0;
        payment.sentByPayer = true;
        payable(_payee).transfer(amount);

        emit PaymentSent(msg.sender, _payee, amount);
    }

    // 수취인이 보류 기간이 끝난 후 돈을 수령하는 함수
    function receivePayment(address _payer, address _payee) external {
        Payment storage payment = payments[_payer][_payee];
        require(payment.amount > 0, "No pending payment");
        require(block.timestamp >= payment.timestamp + holdPeriod, "Hold period not over yet");
        require(!payment.isHeld, "Payment is on hold"); // 보류 상태 확인

        uint amount = payment.amount;
        payment.amount = 0;

        // Transfer the payment amount to the payee
        payable(_payee).transfer(amount);

        totalPaymentsByPayer[_payer] -= amount;
        totalpaymentsByPayee[_payee] -= amount;

        emit PaymentCompleted(_payer, _payee, amount);
    }

    // 특정 지불자와 수취인 간의 미결제 금액을 반환하는 함수
    function viewPendingPayment(address _payer, address _payee) external view returns (uint) {
        return payments[_payer][_payee].amount;
    }

    // 특정 지불자와 수취인 간의 결제 타임스탬프를 반환하는 함수
    function viewPaymentTimestamp(address _payer, address _payee) external view returns (uint) {
        return payments[_payer][_payee].timestamp;
    }

    // 수취인이 받은 보류중 금액 조회
    function viewPaymentsByPayee(address _payee) external view returns (uint) {
        return totalpaymentsByPayee[_payee];
    }

    // 지불자가 보낸 모든 결제 금액 조회
    // 지갑 주소와 연관된 모든 보류 중인 거래 금액의 총합을 조회하는 함수
    function viewTotalPendingPaymentsSentByPayer(address _wallet) external view returns (uint) {
        uint totalPendingAmount = 0;

        // _wallet이 지불자인 모든 보류 중 거래에 대해 금액을 합산
        for (uint i = 0; i < payeesByPayer[_wallet].length; i++) {
            Payment memory payment = payments[_wallet][payeesByPayer[_wallet][i].payee];
            if (payment.amount > 0) {
                totalPendingAmount += payment.amount;
            }
        }

        return totalPendingAmount;
    }

    // 특정 지불자에 대한 모든 itemKey 조회
    function viewItemKeysPayer(address _payer) external view returns (string[] memory) {
        uint itemCount = 0;
        address[] memory payees = new address[](payeesByPayer[_payer].length);
        for (uint i = 0; i < payees.length; i++) {
            payees[i] = payeesByPayer[_payer][i].payee;
            itemCount += itemKeys[_payer][payees[i]].length;
        }
        string[] memory keys = new string[](itemCount);
        uint index = 0;
        for (uint i = 0; i < payees.length; i++) {
            address payee = payees[i];
            string[] storage payeeKeys = itemKeys[_payer][payee];
            for (uint j = 0; j < payeeKeys.length; j++) {
                keys[index] = payeeKeys[j];
                index++;
            }
        }
        return keys;
    }

    // 특정 수취인에 대한 모든 itemKey 조회
    function viewItemKeysPayee(address _payee) external view returns (string[] memory) {
        address[] memory payers = paymentsByPayee[_payee];

        // 임시 배열 크기를 설정한 후, 나중에 크기를 조정
        uint maxItems = 256; // 예상되는 최대 크기 설정
        string[] memory tempKeys = new string[](maxItems);
        uint index = 0;

        for (uint i = 0; i < payers.length; i++) {
            string[] storage payerKeys = itemKeys[payers[i]][_payee];

            for (uint j = 0; j < payerKeys.length; j++) {
                bool exists = false;

                // 중복 체크: 현재까지의 tempKeys 배열에서 해당 key가 존재하는지 확인
                for (uint k = 0; k < index; k++) {
                    if (keccak256(bytes(tempKeys[k])) == keccak256(bytes(payerKeys[j]))) {
                        exists = true;
                        break;
                    }
                }

                // 중복되지 않으면 추가
                if (!exists) {
                    tempKeys[index] = payerKeys[j];
                    index++;
                }
            }
        }

        // 중복이 제거된 최종 배열 생성
        string[] memory uniqueKeys = new string[](index);
        for (uint i = 0; i < index; i++) {
            uniqueKeys[i] = tempKeys[i];
        }

        return uniqueKeys;
    }

    // 수취인이 받은 모든 custNum 조회
    function viewCustNumsPayee(address _payee) external view returns (uint[] memory) {
        uint itemCount = 0;
        address[] storage payers = paymentsByPayee[_payee];
        for (uint i = 0; i < payers.length; i++) {
            address payer = payers[i];
            itemCount += custNums[payer][_payee].length;
        }
        uint[] memory nums = new uint[](itemCount);
        uint index = 0;
        for (uint i = 0; i < payers.length; i++) {
            address payer = payers[i];
            uint[] storage payerNums = custNums[payer][_payee];
            for (uint j = 0; j < payerNums.length; j++) {
                nums[index] = payerNums[j];
                index++;
            }
        }
        return nums;
    }

    // 보류가 끝난 금액 조회
    function viewCompletedPaymentsByPayee(address _payee) external view returns (uint) {
        uint completedPayments = 0;
        for (uint i = 0; i < paymentsByPayee[_payee].length; i++) {
            address payer = paymentsByPayee[_payee][i];
            Payment storage payment = payments[payer][_payee];
            if (payment.amount > 0 && block.timestamp >= payment.timestamp + holdPeriod) {
                completedPayments += payment.amount;
            }
        }
        return completedPayments;
    }
}