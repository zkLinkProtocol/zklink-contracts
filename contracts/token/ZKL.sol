// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ILayerZeroReceiver.sol";
import "./ILayerZeroEndpoint.sol";

/// @title ZkLink token contract implement ILayerZeroReceiver interface
/// @author zk.link
contract ZKL is ERC20Capped, ERC20Permit, ReentrancyGuard, ILayerZeroReceiver {

    /// @notice LayerZero endpoint used to send message to other chains
    ILayerZeroEndpoint public endpoint;
    /// @notice controller of this contract
    address public networkGovernor;
    /// @notice zkl contract address on other chains
    mapping(uint16 => bytes) public destination;
    /// @notice a switch to determine if token can bridge to other chains
    bool public bridgeable;

    event BridgeTo(uint16 indexed lzChainId, bytes receiver, uint amount);
    event BridgeFrom(uint16 indexed lzChainId, address receiver, uint amount);

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, 'ZKL: require governor');
        _;
    }

    modifier onlyLZEndpoint {
        require(msg.sender == address(endpoint), 'ZKL: require LZ endpoint');
        _;
    }

    constructor(string memory _name,
        string memory _symbol,
        uint256 _cap,
        address _endpoint,
        address _networkGovernor,
        bool _isGenesisChain) ERC20(_name, _symbol) ERC20Capped(_cap) ERC20Permit(_name) {
        endpoint = ILayerZeroEndpoint(_endpoint);
        networkGovernor = _networkGovernor;
        // initial all zkl to networkGovernor at the genesis chain
        if (_isGenesisChain) {
            _mint(_networkGovernor, _cap);
        }
        bridgeable = true;
    }

    /// @notice Set bridge switch
    function setBridgeable(bool _bridgeable) external onlyGovernor {
        bridgeable = _bridgeable;
    }

    /// @notice Set bridge destination
    /// @param _lzChainId LayerZero chain id on other chains
    /// @param _contractAdd ZKL contract address on other chains
    function setDestination(uint16 _lzChainId, bytes calldata _contractAdd) external onlyGovernor {
        destination[_lzChainId] = _contractAdd;
    }

    /// @notice Set multiple bridge destinations
    /// @param lzChainIds LayerZero chain id on other chains
    /// @param contractAdds ZKL contract address on other chains
    function setDestinations(uint16[] memory lzChainIds, bytes[] memory contractAdds) external onlyGovernor {
        require(lzChainIds.length == contractAdds.length, 'ZKL: destination length not match');
        for(uint i = 0; i < lzChainIds.length; i++) {
            destination[lzChainIds[i]] = contractAdds[i];
        }
    }

    /// @notice Estimate bridge fees
    /// @param _lzChainId the destination chainId
    /// @param _receiver the destination receiver address
    /// @param _amount the amount to bridge
    function estimateBridgeFees(uint16 _lzChainId, bytes calldata _receiver, uint _amount) view external returns(uint) {
        bytes memory payload = abi.encode(_receiver, _amount);
        return endpoint.estimateNativeFees(_lzChainId, address(this), payload, false, bytes(""));
    }

    /// @notice Bridge zkl to other chain
    /// @param _lzChainId the destination chainId
    /// @param _receiver the destination receiver address
    /// @param _amount the amount to bridge
    function bridge(uint16 _lzChainId, bytes calldata _receiver, uint _amount) public payable nonReentrant {
        require(bridgeable, 'ZKL: bridge disabled');

        bytes memory zklDstAdd = destination[_lzChainId];
        require(zklDstAdd.length > 0, 'ZKL: invalid lz chain id');

        // burn token from sender
        _burn(msg.sender, _amount);

        // encode the payload with the receiver and amount to send
        bytes memory payload = abi.encode(_receiver, _amount);

        // send LayerZero message
        endpoint.send{value:msg.value}(_lzChainId, zklDstAdd, payload, payable(msg.sender), address(0x0), bytes(""));

        emit BridgeTo(_lzChainId, _receiver, _amount);
    }

    /// @notice Receive the bytes payload from the source chain via LayerZero and mint token to receiver
    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 /**_nonce**/, bytes calldata _payload) override external onlyLZEndpoint nonReentrant {
        require(bridgeable, 'ZKL: bridge disabled');

        // reject invalid src contract address
        bytes memory zklSrcAdd = destination[_srcChainId];
        require(zklSrcAdd.length > 0, 'ZKL: invalid lz chain id');
        require(keccak256(zklSrcAdd) == keccak256(_srcAddress), 'ZKL: invalid zkl src address');

        // mint token to receiver
        (bytes memory receiverBytes, uint amount) = abi.decode(_payload, (bytes, uint));
        address receiver;
        assembly {
            receiver := mload(add(receiverBytes, 20))
        }
        _mint(receiver, amount);

        emit BridgeFrom(_srcChainId, receiver, amount);
    }

    /**
     * @dev See {ERC20-_mint}.
     */
    function _mint(address account, uint256 amount) internal override(ERC20Capped, ERC20) {
        ERC20Capped._mint(account, amount);
    }
}
