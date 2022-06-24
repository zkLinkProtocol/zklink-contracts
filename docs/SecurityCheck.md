## File

P1 - SPDX header

P2 - Remove unused imported contract

P3 - Remove unused code

P4 - Remove solhints that aren't needed

## Contract

T1 - Outdated compiler version not used (SWC-102)

T2 - Use fixed compiler version to compile contract (SWC-103)

T3 - Check for correct inheritance, keep it simple and linear (SWC-125)

T4 - Constructor should not be exsited in proxyed contract

T5 - Right-To-Left-Override control character not used (SWC-130)

## Variables

V1 - Is visibility set (SWC-108)

V2 - Can they be private?

V3 - Can it be constant?

V4 - Can it be immutable?

V5 - No unused variables (SWC-131)

V6 - Can be a smaller type?

V7 - Storage multiple variables in a slot

V8 - Don't initialize variables of proxyed contract

V9 - Don't delete or change variables order of proxyed contract

## Events

E1 - Should any argument be indexed

E2 - Don't abuse indexed attribute

## Modifiers

M1 - No state changes (except for a reentrancy lock)

M2 - No external calls

M3 - Checks only

M4 - Should use inline function instead of modifier to reduce contract bytecode size?

## Functions

F1 - Set visibility: Change external to public to support batching. Should it be private? (SWC-100)

F2 - Should it be payable?

F3 - Can use calldata to replace memory of reference params?

F4 - Are the correct modifiers applied, such as onlyOwner, nonReentrant

F5 - Check behaviour for all function arguments when wrong or extreme

F6 - Checks-Effects-Interactions pattern followed? (SWC-107)

## Code

C1 - All math done through SafeMath (SWC-101)

C2 - Are any unbounded loops/arrays used that can cause DoS? (SWC-128)

C3 - Use block.timestamp only for long intervals (SWC-116)

C4 - Don't use block.number for elapsed time (SWC-116)

C5 - Don't use assert (SWC-110)

C6 - Don't use  tx.origin (SWC-115)

C7 - Don't use blockhash, etc for randomness (SWC-120)

C8 - Protect signatures against replay, use EIP-712 (SWC-117 SWC-121)

C9 - Can abi.encodePacked lead to a hash collision? (SWC-133)

C10 - Local variables should never shadow state variables (SWC-119)

C11 - Careful with assembly, don't allow any arbitrary use data (SWC-127)

C12 - Are any storage slots read multiple times?

C13 - Is calculation on the fly cheaper than storing the value

C14 - Is > or < or >= or <= correct

C15 - Are logical operators correct ==, !=, &&, ||, !

C16 - Check for front-running possibilities (SWC-114)

### Call

L1 - Is external function call, staticcall or delegatecall trusted? (SWC-112)

L2 - Is external function call, staticcall or delegatecall can be run out of gas? (SWC-113)

L3 - Is external function call, delegatecall can be caused a gas minting attack?

L4 - Is the result checked and errors dealt with? (SWC-104)

L5 - Is a lock used? If so are the external calls protected?

L6 - Can a closed loop call such as f0 -> f1 -> f0 make attacker a profit?

L7 - Can delegated contract be selfdestruct?

L8 - Is an external contract call needed?

L9 - Don't use msg.value repeatedly at delegatecall

### Token

A1 - Recipent-Withdraw pattern followed?

A2 - Use call to send eth to a contract address and check the result (SWC-134)

A3 - Don't assume a specific ETH balance (and token) (SWC-132)

A4 - Does msg.sender has the authority to move token of other addresses?

A5 - Use the balance difference as the amount when non-standard token deposit in or withdraw out of contract

A6 - Is there a possiblity that tokens can not be retrieved?

A7 - Is code is still correct if the token contract is upgradable?

A8 - Is code is still correct if the token contract  has hooks when transfer such as ERC677, ERC777, ERC1155?

### Price

O1 - Does everyone has the authority to set oracle?

O2 - Use TWP of onchain oracle

O3 - The price of LP is correct?

O4 - Is there a possiblity that lend a large amout of low-value token and manipulate its price to borrow a high-value token?

## Reference

https://docs.soliditylang.org/en/v0.8.15/security-considerations.html#security-considerations

https://github.com/boringcrypto/BoringSolidity/blob/master/docs/checks.txt

https://swcregistry.io/
