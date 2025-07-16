// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract StudentID {
    // 구조체 정의: 학생 정보
    struct Student {
        string id;
        string name;
        uint256 age;
        uint256 class_of;
        string gender;
        bool isEnrolled;
    }
    
    // 매핑: 학생 주소에 해당하는 학생 정보 매핑
    mapping(address => Student) public students;
    
    // 이벤트: 학생이 등록되었을 때 발생하는 이벤트
    event StudentEnrolled(address indexed studentAddress, string id, string name, uint256 age, uint256 class_of, string gender);

    // modifier: 학생이 등록되지 않았을 때 함수를 실행하지 못하도록 하는 modifier
    modifier onlyUnenrolled() {
        require(!students[msg.sender].isEnrolled, "not.");
        _;
    }

    // 학생 등록 함수: 학생 정보를 등록하는 함수
    function enrollStudent(string memory _id, string memory _name, uint256 _age, uint256 _class_of, string memory _gender) public onlyUnenrolled {
        students[msg.sender] = Student(_id, _name, _age, _class_of, _gender, true);
        emit StudentEnrolled(msg.sender, _id, _name, _age, _class_of, _gender);
    }

    // 학생 정보 조회 함수: 주어진 주소의 학생 정보를 반환하는 함수
    function getStudent(address studentAddress) public view returns (string memory, string memory, uint256, uint256, string memory, bool) {
        return (students[studentAddress].id, students[studentAddress].name, students[studentAddress].age, 
        students[studentAddress].class_of, students[studentAddress].gender, students[studentAddress].isEnrolled);
    }

    function getStudentInfo(address studentAddress) public view returns (string memory, string memory, uint256, uint256, string memory) {
        if (!students[studentAddress].isEnrolled) {
            return ("", "", 0, 0, "");
        }
        return (students[studentAddress].id, students[studentAddress].name, students[studentAddress].age, students[studentAddress].class_of, students[studentAddress].gender);
    }
}