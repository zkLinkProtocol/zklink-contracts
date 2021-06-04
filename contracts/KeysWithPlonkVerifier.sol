// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./PlonkCore.sol";

// Hardcoded constants to avoid accessing store
contract KeysWithPlonkVerifier is VerifierWithDeserialize {

    uint256 constant VK_TREE_ROOT = 0x1825df40e06d0cfbb08aac99147e93d292664bcea723f28f2112688d96833fa5;
    uint8 constant VK_MAX_INDEX = 5;

    function getVkAggregated(uint32 _proofs) internal pure returns (VerificationKey memory vk) {
        if (_proofs == uint32(1)) { return getVkAggregated1(); }
        else if (_proofs == uint32(4)) { return getVkAggregated4(); }
        else if (_proofs == uint32(8)) { return getVkAggregated8(); }
        else if (_proofs == uint32(18)) { return getVkAggregated18(); }
    }


    function getVkAggregated1() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 4194304;
        vk.num_inputs = 1;
        vk.omega = PairingsBn254.new_fr(0x18c95f1ae6514e11a1b30fd7923947c5ffcec5347f16e91b4dd654168326bede);
        vk.gate_setup_commitments[0] = PairingsBn254.new_g1(
            0x1b2d28f346ba6302090869b58c0ccf45994c8aaee54101d489e4605b9b9d69a5,
            0x05b254b5537aede870276a46ae3046ae4cb36a5e41b1a1208355a4b2de0fc3c4
        );
        vk.gate_setup_commitments[1] = PairingsBn254.new_g1(
            0x0e111faf12e663d8e6aa9b7c434376e13fb4ae52bb597bcc23f2044710daa60a,
            0x16505d91104cdf110698ebe99f0abd162630e4b108356640d1abd8596c4680d2
        );
        vk.gate_setup_commitments[2] = PairingsBn254.new_g1(
            0x0e6aaf4f2ceb4d0b781ccbcb8c6b235d6c74df0079e8db8eefc9539b6ca2d920,
            0x0779a9706bd1a8315662914928188f51a2081d1bbeb863a1f6945ab6e1752513
        );
        vk.gate_setup_commitments[3] = PairingsBn254.new_g1(
            0x12f8cc0d6eaa884fa1fa6ec2c23cd21892dff4298c67451f6c234293a85d977b,
            0x165d8106e03536fcf8c66391ee31e97b00664932d63d61a008108d68f8da2dcd
        );
        vk.gate_setup_commitments[4] = PairingsBn254.new_g1(
            0x282ab78735c94c7d4fe2b134e7cee6bf967921c744b2df5b1ac7980ca39a6ef4,
            0x0f627a1b42661cca9fa1e2de44d78413a1817b0ea44506de524f3aeb43b00c69
        );
        vk.gate_setup_commitments[5] = PairingsBn254.new_g1(
            0x0f1abdaaea6fc0c841cbdbb84315392c7de7270704d2bd990f3205f06f3c2e72,
            0x18e32227065587b5814b4d1f8d7f78689af94f711d0521575c2ad723706403ac
        );
        vk.gate_setup_commitments[6] = PairingsBn254.new_g1(
            0x2e43a380b145f473c7b76c29110fa2a54d29e39e4c3e7a0667656f5d7c6fa783,
            0x0c56e0e6679b4b71113d073ad16a405c62f1154a37202dcefce83ab2aa2bfd99
        );
        vk.gate_selector_commitments[0] = PairingsBn254.new_g1(
            0x287f80f33b27cac8c1d7ea38e3f38b9547fc64241f369332ced9f13255f02a11,
            0x0019b4dfa8d1fa5172b3609a3ee75532a8fcdd946df313edb466502baec90916
        );
        vk.gate_selector_commitments[1] = PairingsBn254.new_g1(
            0x262c679d64425eba4718852094935ed36c916c8e58970723ab56a6edfec8ee53,
            0x11512b535dcd41a87ff8fe16b944b0fc33a13b6ab82bed1e1fef9f887fb8bd17
        );
        vk.copy_permutation_commitments[0] = PairingsBn254.new_g1(
            0x06e470b8f5828b55b7c2a1c25879f07c2e60ff3936de7c7a9a1d0cf11c7154cb,
            0x0183d6431267f015d722e1e47fae0d8f6a66b1b75c271f6f2f7a19fd9bde0deb
        );
        vk.copy_permutation_commitments[1] = PairingsBn254.new_g1(
            0x2c42b01e3e994120ebbc941def201a6242ceca9d24a5b0c21c1e00267126eb03,
            0x2b3ee88ed3e1550605d061cb8db20ff97560e735f23e3234b32b875b2b0af854
        );
        vk.copy_permutation_commitments[2] = PairingsBn254.new_g1(
            0x20f62698b7f1defcc8da79330979c7d176d2c9b72d031dac96e1db91c7596f22,
            0x0ff81068a3a7706205893199514f4bbf06aa644ba08591b2b5cf315136fbbe89
        );
        vk.copy_permutation_commitments[3] = PairingsBn254.new_g1(
            0x1645e6c282336dfd4ec70d4ebb71050390f70927a887dcfd6527070659f3a7e7,
            0x1c93ca29a27a931a34482db88bed589951aa7d406b5583da235bf618fb4d048e
        );
        vk.copy_permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.copy_permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.copy_permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );

        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1,
            0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4,
            0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }

    function getVkAggregated4() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 8388608;
        vk.num_inputs = 1;
        vk.omega = PairingsBn254.new_fr(0x1283ba6f4b7b1a76ba2008fe823128bea4adb9269cbfd7c41c223be65bc60863);
        vk.gate_setup_commitments[0] = PairingsBn254.new_g1(
            0x003afae7b782054ff6a437e54aff5e1086b8674197d2b93ac0a18251d4e6dc22,
            0x285c4b07c20db3cdd7359d980fce202cd3a203e6068409ac8d0d4d024323e78d
        );
        vk.gate_setup_commitments[1] = PairingsBn254.new_g1(
            0x1752602c8accc76f98e15d68a5d590621d7b5e2ed2c67c11fb240e5851654c72,
            0x11fc0e19e71835f2da8c52ed7296b45994e26f8605251ae67a96df49fa0d724f
        );
        vk.gate_setup_commitments[2] = PairingsBn254.new_g1(
            0x2d0e2a1ef38fafe5f9d0ca83acdf70c2bd673d7615618fd3929e4414a8cfd726,
            0x0776082cc19f77461dc2fdf16fc6cc189b4c9b5fafa860fbbac7228fabd72ccb
        );
        vk.gate_setup_commitments[3] = PairingsBn254.new_g1(
            0x20afbdefb66bdcbe14ac2f75c3d5354f5cc9d4e371cd955ed5ff08f9225f3afe,
            0x17b87b9d12adae345353ef2affaf5d9d090c56dea25c57856d32a5f617e46c55
        );
        vk.gate_setup_commitments[4] = PairingsBn254.new_g1(
            0x20b82ee5bfc5fc4bcc522d639f7f2be16e62c992818b0f84a7caeef7b1cc1393,
            0x0a10054e23a03d9c5e8b4a751ef82ad389f5e6af1959eeb23dd36536a8e9f845
        );
        vk.gate_setup_commitments[5] = PairingsBn254.new_g1(
            0x21bffb88353357100e5537b55ad0739dc81c5b2a2224411de8df9b73a56e9cc4,
            0x269be6640e56d2a33033c333c9786eee0b078cbc5319e067b305a7501309fca9
        );
        vk.gate_setup_commitments[6] = PairingsBn254.new_g1(
            0x02f1a1df9628c5c83e5abe3af36b032366d7ef9cb9d96f97dd402aa01f054d6b,
            0x0f8b5b237dda5bd4fd08282c988c75334a1dcd6e6ba75a09703d88b76d3a49a9
        );
        vk.gate_selector_commitments[0] = PairingsBn254.new_g1(
            0x058a6b76530a3263918d1a6b3a34a8828f9d14de3480f96a83572977d485bad3,
            0x1aac6b86abfb9413d699a339b2eb675a849e7ab8e62bda5b109e45f3d98c7e78
        );
        vk.gate_selector_commitments[1] = PairingsBn254.new_g1(
            0x06dda5991f13700cce7f714116b1d4da183b09ff7ba87b3a0baab284e273b6f4,
            0x0df202a06cfdf124ca73029570bdc8b27d0adc6f9c66183e5dead5ea692b9d33
        );
        vk.copy_permutation_commitments[0] = PairingsBn254.new_g1(
            0x087ba5945331b19901b5ff79ee6798405d60ad235f259a5370ff11b7abb02fb6,
            0x2abc220d6c5493187c235fd362495435734cae30a62f55380079ce49402ec9ec
        );
        vk.copy_permutation_commitments[1] = PairingsBn254.new_g1(
            0x2c76802cf99e8110e9bf6a04e3f2f044f935fe5146e420b62cf33c9471c6ee8d,
            0x06ea23ae66f93a5a52a0bd033f2a8dde6d12dc19cb3c7b0df1441b1cecbc2676
        );
        vk.copy_permutation_commitments[2] = PairingsBn254.new_g1(
            0x054f7e5bcb8de6145e77eba1dfa0a7a7041caf3f6c888f97758e51d86527871b,
            0x2698bfa2800eab77b6be534b9e1f36089888f453eff641be4905098500332f96
        );
        vk.copy_permutation_commitments[3] = PairingsBn254.new_g1(
            0x2fc493b05505bbea2ca1204c63ec3efe304ccbf55939727a2c120dd036f8f669,
            0x01c6c6ba67415f5976a90046e80b783b8381f112a6b5dc0f9549e559888edf44
        );
        vk.copy_permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.copy_permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.copy_permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );

        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1,
            0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4,
            0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }

    function getVkAggregated8() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 16777216;
        vk.num_inputs = 1;
        vk.omega = PairingsBn254.new_fr(0x1951441010b2b95a6e47a6075066a50a036f5ba978c050f2821df86636c0facb);
        vk.gate_setup_commitments[0] = PairingsBn254.new_g1(
            0x2aed0f7587fb53228b56996fc5c68c786e94ea85e39cee07ea6ab88c790fd599,
            0x0d95c66c1009c7835683905d6172794b84b76c06c3eb50364a3d5403124ad583
        );
        vk.gate_setup_commitments[1] = PairingsBn254.new_g1(
            0x1ebe365381011f2d968d31f27492c35b236cb24eb764ce3487350a9479b8ba2c,
            0x07c060531b8cd5848909e9a033331b49841582c5b1dd9212fd36daf4f080b458
        );
        vk.gate_setup_commitments[2] = PairingsBn254.new_g1(
            0x0bb638c14c24e76f14579ec75e8ca051e1cb4c51eb22c5db10251381677e222b,
            0x2f535ad57b1f4379299d3e1eacb6a44652e4aeb11d17378e8f86e3f89aceece5
        );
        vk.gate_setup_commitments[3] = PairingsBn254.new_g1(
            0x22b2486cc041273ca7a97849818580eed4a7bac30bccec181074ceb116463458,
            0x03d9210b8ab88ed4727ebdbd0f454acd29abc39cf02288c46ee48ab4fdf03eaf
        );
        vk.gate_setup_commitments[4] = PairingsBn254.new_g1(
            0x18b200063185c5d001b1d0e6ddd51e197bb8548886873b1a9724161302f80216,
            0x1a301ae3e1b9ed496a9ba20c390827c707dd9ec7e79502b2f1f112ca72fea83d
        );
        vk.gate_setup_commitments[5] = PairingsBn254.new_g1(
            0x130bb188892b683c412ae8a0414236e5406a12593e637cdd7aea58fcbfe642bb,
            0x018ff5fe5d3b7183a3ebb561977328ffea2a3ffbe65519e68601237f93d8d44c
        );
        vk.gate_setup_commitments[6] = PairingsBn254.new_g1(
            0x117124dcfb53862da15b26b3106d5413a027f5a1bc692197de9d232756702dfb,
            0x1090cb8a5f2250bdae1ce9d5036cdbafcb18aae7984280f3a5f7953186603afc
        );
        vk.gate_selector_commitments[0] = PairingsBn254.new_g1(
            0x1249c67168759250ff084478c93e08ef95f773a5af9f2c64771aa613cee8647a,
            0x0df71e2c6cf6f92ad48a4ad30f835b4e8f55d958fbc9aea3fd288118143952b5
        );
        vk.gate_selector_commitments[1] = PairingsBn254.new_g1(
            0x0f3a4a415e0a8bd5cf8e9ae28581a761a3c6ba2a06f7342411d89104eb826b02,
            0x19b31211cf50a00ef9517c441a97de8f230262bad13c87de3b7867ab02607984
        );
        vk.copy_permutation_commitments[0] = PairingsBn254.new_g1(
            0x2e4a28f471265095e61964d3bbaecf3426c334c4dcf77cd8587baae110b121a0,
            0x0b59a19d813da05115de4762bd9ab51c966f5e24fd3ca6755ff055fef8072ca5
        );
        vk.copy_permutation_commitments[1] = PairingsBn254.new_g1(
            0x2599b11f211d5317e20d0af3124b681280fa0cbdaf6e8de417e3e55798685caf,
            0x2088ce807239d036cb626a7da17adafe31ee3550acd61c4d8701376b3b24fb51
        );
        vk.copy_permutation_commitments[2] = PairingsBn254.new_g1(
            0x1da84959795544b67e074658448ec3a46f68ad19ad1a4a6724bc664591d20575,
            0x259c29eb06ebd9e9d4061b52efdb7c64e1855329433e7ff41e9ff822723e0f34
        );
        vk.copy_permutation_commitments[3] = PairingsBn254.new_g1(
            0x1e6a691f593d98ee939c4ed04b468dfe554478d476ece3775eb9126f814a27dc,
            0x080b9ef5f9ca7f5a999c6a43bcc5bc67007e74ed0d90882a9bf04fb890384a05
        );
        vk.copy_permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.copy_permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.copy_permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );

        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1,
            0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4,
            0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }

    function getVkAggregated18() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 33554432;
        vk.num_inputs = 1;
        vk.omega = PairingsBn254.new_fr(0x0d94d63997367c97a8ed16c17adaae39262b9af83acb9e003f94c217303dd160);
        vk.gate_setup_commitments[0] = PairingsBn254.new_g1(
            0x22c34e87db1c7cabe05c260f4b1ab56b9df3a16f8f065132fca08188878b6846,
            0x01092dce64969094387268ee9a1f059720b3420f855453570a34910299b02430
        );
        vk.gate_setup_commitments[1] = PairingsBn254.new_g1(
            0x10b491895d3666b4b9bbb18ea3fbcc6607831c153279d0554a956c8247f49fc4,
            0x01a40cf9fdb32f138825d023ae655b135713d24015bc6b629a16d35a68537657
        );
        vk.gate_setup_commitments[2] = PairingsBn254.new_g1(
            0x221de6ef2222bbcd694daa876c2e3adf34cff223cf58dbeebf6def38342d1664,
            0x0d982c940317ac66632a0354f441a4be3408e6db272114d79a4834b7a4a20113
        );
        vk.gate_setup_commitments[3] = PairingsBn254.new_g1(
            0x017ee0bd160be4a3b261f16cdb5eb4c95cacc8c04b7c033142e93ecca7220ba2,
            0x05cde74e73348375b0e47f1f4f3d894fef90633fe475967f0243cda1643151cf
        );
        vk.gate_setup_commitments[4] = PairingsBn254.new_g1(
            0x073e38b4cdf00627dc9074ba9f941fe6a132787bc5f07ba39d3601c19e0f3019,
            0x15584337ede2fd27d04a740870c5a4614bf0b30f6d05efffbad120c61f356021
        );
        vk.gate_setup_commitments[5] = PairingsBn254.new_g1(
            0x2560e1faeb4e0cd62c699909621bc1be4a2fa8ce8eaef4dacfafd9b93e32c37c,
            0x28ffa10037d7e86024b4ebc8d38b51db9b8d449c41ffd7cc531bfc7e8639f93a
        );
        vk.gate_setup_commitments[6] = PairingsBn254.new_g1(
            0x0ab4fd76ade54d1ecb9557227abc595ea8321a78bb238c156404e6dfe909330c,
            0x205ef99a7bd497f9930dfda6f1d6b5b7cf1c1c11dba92cc7ddd1bfeead925692
        );
        vk.gate_selector_commitments[0] = PairingsBn254.new_g1(
            0x0f4bbf1c063eafceab5db36646f088b653904d98e8db6557a5481723ee03e63f,
            0x0c28d0481d372199db93cd2624b4590cfbc85ccbdd4b4617bf143913805dad1e
        );
        vk.gate_selector_commitments[1] = PairingsBn254.new_g1(
            0x09cdf995f6b1aa7117c78d61b05983748233b4cd3215f11ce90d68403f8e919a,
            0x1f2e6ca97ca6beb393e87ef1e8729cc9239726b592e62be5eb3e91ea1b013066
        );
        vk.copy_permutation_commitments[0] = PairingsBn254.new_g1(
            0x2b6ac30a4cf20339f38ebdbe4e49e86755cf0d01d4cae3cd4b917ae04d42da60,
            0x00d48d03dd23ba2dfa883b33153442fd723dc480e8164309c0cbdcafb6b03756
        );
        vk.copy_permutation_commitments[1] = PairingsBn254.new_g1(
            0x17bdb5fac2a956ab5c8212a241fa7f5ef39538fb2280228d08baab796070961e,
            0x25e7d5d7fa542aa861aad4e70a34c0994aa9e118404c23ef8b4606f39297a775
        );
        vk.copy_permutation_commitments[2] = PairingsBn254.new_g1(
            0x1072c13ae46914f859d815c7b116e227ed6baf5b3e9a8f301e5bfbbc52a85c2a,
            0x1fafa2dbeed434ff1a24d63e3768c9ee4953a83a8a05503bf616412871af4e95
        );
        vk.copy_permutation_commitments[3] = PairingsBn254.new_g1(
            0x1e5fd3f86f7f6a66ada15c059dfda371f0cbd4647592be9e4c5fb00f9f85fcbe,
            0x2e3fd2f0c02d7c2d748f05338b1b34b9cd3d7ddb2dde4504b7865ce84690526f
        );
        vk.copy_permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.copy_permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.copy_permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );

        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1,
            0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4,
            0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }


}

// Hardcoded constants to avoid accessing store
contract KeysWithPlonkVerifierOld is VerifierWithDeserializeOld {


    function getVkExit() internal pure returns(VerificationKeyOld memory vk) {
        vk.domain_size = 262144;
        vk.num_inputs = 1;
        vk.omega = PairingsBn254.new_fr(0x0f60c8fe0414cb9379b2d39267945f6bd60d06a05216231b26a9fcf88ddbfebe);
        vk.selector_commitments[0] = PairingsBn254.new_g1(
            0x117ebe939b7336d17b69b05d5530e30326af39da45a989b078bb3d607707bf3e,
            0x18b16095a1c814fe2980170ff34490f1fd454e874caa87df2f739fb9c8d2e902
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x05ac70a10fc569cc8358bfb708c184446966c6b6a3e0d7c25183ded97f9e7933,
            0x0f6152282854e153588d45e784d216a423a624522a687741492ee0b807348e71
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x03cfa9d8f9b40e565435bee3c5b0e855c8612c5a89623557cc30f4588617d7bd,
            0x2292bb95c2cc2da55833b403a387e250a9575e32e4ce7d6caa954f12e6ce592a
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x04d04f495c69127b6cc6ecbfd23f77f178e7f4e2d2de3eab3e583a4997744cd9,
            0x09dcf5b3db29af5c5eef2759da26d3b6959cb8d80ada9f9b086f7cc39246ad2b
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x01ebab991522d407cfd4e8a1740b64617f0dfca50479bba2707c2ec4159039fc,
            0x2c8bd00a44c6120bbf8e57877013f2b5ee36b53eef4ea3b6748fd03568005946
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x07a7124d1fece66bd5428fcce25c22a4a9d5ceaa1e632565d9a062c39f005b5e,
            0x2044ae5306f0e114c48142b9b97001d94e3f2280db1b01a1e47ac1cf6bd5f99e
        );

        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x1dd1549a639f052c4fbc95b7b7a40acf39928cad715580ba2b38baa116dacd9c,
            0x0f8e712990da1ce5195faaf80185ef0d5e430fdec9045a20af758cc8ecdac2e5
        );

        vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x0026b64066e39a22739be37fed73308ace0a5f38a0e2292dcc2309c818e8c89c,
            0x285101acca358974c2c7c9a8a3936e08fbd86779b877b416d9480c91518cb35b
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x2159265ac6fcd4d0257673c3a85c17f4cf3ea13a3c9fb51e404037b13778d56f,
            0x25bf73e568ba3406ace2137195bb2176d9de87a48ae42520281aaef2ac2ef937
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x068f29af99fc8bbf8c00659d34b6d34e4757af6edc10fc7647476cbd0ea9be63,
            0x2ef759b20cabf3da83d7f578d9e11ed60f7015440e77359db94475ddb303144d
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x22793db6e98b9e37a1c5d78fcec67a2d8c527d34c5e9c8c1ff15007d30a4c133,
            0x1b683d60fd0750b3a45cdee5cbc4057204a02bd428e8071c92fe6694a40a5c1f
        );

        vk.permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );

        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1, 0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4, 0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }

}
