# Open-source Altium references

Run `bun run download-references` to download real Altium board and schematic
files from immutable GitHub revisions. The binary files are ignored by Git and
are not distributed under this repository's MIT license. The download script
verifies each file's SHA-256 digest before writing it.

## Boards

| Local file | Upstream file | Revision | License | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `nodemcu-esp12.PcbDoc` | [`nodemcu/nodemcu-devkit/NODEMCU_ESP12.PcbDoc`](https://github.com/nodemcu/nodemcu-devkit/blob/b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce/NODEMCU_ESP12.PcbDoc) | `b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce` | MIT | 4,480,512 | `5060fb6f0e80af09c8d5af376038a4e55044b28ae1d4dfa6a1fa354a6ea1e2f2` |
| `ebaz4205.PcbDoc` | [`xjtuecho/EBAZ4205/ebit_ad.PcbDoc`](https://github.com/xjtuecho/EBAZ4205/blob/05cdb45035a06fc5b4db16babf0ac6f4ee4497be/HW/ebaz4205/altium/ebit_ad.PcbDoc) | `05cdb45035a06fc5b4db16babf0ac6f4ee4497be` | MIT | 3,618,816 | `1dbeba2537bdf83e77bc9c5a7a6f2f7bf1104193f3dc2547d020dbd8018b4e62` |
| `heron-payload-ssm.PcbDoc` | [`utat-ss/HERON-pcbs/pay-ssm-v3.PcbDoc`](https://github.com/utat-ss/HERON-pcbs/blob/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/pay-ssm-v3.PcbDoc) | `7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820` | CERN-OHL-P | 6,072,320 | `47a72219ab21c8eebb5beeab97e8aeca2121efb8561fca1d5f732215d233575d` |
| `simplefoc-mini.PcbDoc` | [`simplefoc/SimpleFOCMini/simplefocmini_2024-04-26.pcbdoc`](https://github.com/simplefoc/SimpleFOCMini/blob/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.pcbdoc) | `8e10d4ba398624bd0ef970e82c03d7a6bcc2220d` | MIT | 201,847 | `8328cebe97ba8623fb2b707490e3473c6f7dc13fb0502b596b0e40c7e1613d24` |
| `simplefoc-shield-v3.PcbDoc` | [`simplefoc/Arduino-SimpleFOCShield/SimpleFOCShieldV3.PcbDoc_2024-06-23.pcbdoc`](https://github.com/simplefoc/Arduino-SimpleFOCShield/blob/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.PcbDoc_2024-06-23.pcbdoc) | `2a83626b86debd5fc5f309ba06b3fb36e3b25533` | MIT | 362,916 | `507a0feb04cf539edd110ff1fe6da8ca8025009140b1934a6fc4df78308bfec5` |
| `simplefoc-stepmini.PcbDoc` | [`simplefoc/SimpleFOC-StepMini/simplefoc-stepmini_2024-05-25.pcbdoc`](https://github.com/simplefoc/SimpleFOC-StepMini/blob/5795cb31faceba53602c9b6bb3b50872cde26345/Altium/simplefoc-stepmini_2024-05-25.pcbdoc) | `5795cb31faceba53602c9b6bb3b50872cde26345` | MIT | 201,815 | `1b8384490277d89b499a7a5963ed29bd0cf548ec8d50fe0354f242cf3148ee02` |
| `pidp11-io-expander.PcbDoc` | [`sstallion/PCB-PiDP11IOExpander/PiDP11IOExpander.PcbDoc`](https://github.com/sstallion/PCB-PiDP11IOExpander/blob/d97b81645091da8404661b37f75e4872c1788f79/PiDP11IOExpander.PcbDoc) | `d97b81645091da8404661b37f75e4872c1788f79` | BSD-2-Clause | 1,696,256 | `1ff7234670ec5e20092d23ecf0cd5e7380e842ef7efff2b5cb992f53f84c9c69` |
| `cobra.PcbDoc` | [`pengwon/cobra/hw/pcb/cobra.PcbDoc`](https://github.com/pengwon/cobra/blob/1347008d7985d8c3dbecc3d81e4bf4e1ace2c33d/hw/pcb/cobra.PcbDoc) | `1347008d7985d8c3dbecc3d81e4bf4e1ace2c33d` | MIT | 1,421,312 | `d0913643166660cfdcc5490d63283b12f4ff08b0dbbaa05e409a9cd9196aa9c5` |
| `ch582.PcbDoc` | [`iot-lorawan/CH582_PCB_SCH/PCB_ch582_2022-06-16.pcbdoc`](https://github.com/iot-lorawan/CH582_PCB_SCH/blob/b65bce802295c6c40413c5bc3ea54682820619c1/PCB_ch582_2022-06-16.pcbdoc) | `b65bce802295c6c40413c5bc3ea54682820619c1` | MIT | 230,054 | `dcf82249e19f9a58f3874e9c56509bab42f3fdf00dc3dd0d52ba9a4f4aeb0649` |
| `quadcopter-controller.PcbDoc` | [`jdekarske/Quadcopter/PCB/fororder.PcbDoc`](https://github.com/jdekarske/Quadcopter/blob/b4285601a1ea73d0453a2065c9580b026611e01c/PCB/fororder.PcbDoc) | `b4285601a1ea73d0453a2065c9580b026611e01c` | MIT | 293,945 | `6d9ea33155ea5fd68942e57f94003110497ca0e16af616e941fe7c25513faea6` |

## Schematics

Four of the original board projects include `.SchDoc` files. EBAZ4205 does
not, so the fifth fixture is the complete `systems_pcb` board schematic from
the already-audited HERON repository.

| Local file | Upstream file | Revision | License | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `nodemcu-esp12.SchDoc` | [`nodemcu/nodemcu-devkit/NODEMCU_ESP12.SchDoc`](https://github.com/nodemcu/nodemcu-devkit/blob/b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce/NODEMCU_ESP12.SchDoc) | `b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce` | MIT | 258,048 | `cd415e8afcc7b47f2a0d7acf1e3a41d2304c4c4f02a70744d710ce24ba09707d` |
| `heron-pay-ssm-top.SchDoc` | [`utat-ss/HERON-pcbs/payload/pay-ssm/TOP.SchDoc`](https://github.com/utat-ss/HERON-pcbs/blob/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/TOP.SchDoc) | `7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820` | CERN-OHL-P | 235,520 | `948eca8d0b9e306909755c11ad94d84eda7e60164d7ecc848dfbe8b77cdc2903` |
| `heron-pay-ssm.PrjPCB` | [`utat-ss/HERON-pcbs/payload/pay-ssm/pay-ssm.PrjPCB`](https://github.com/utat-ss/HERON-pcbs/blob/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/pay-ssm.PrjPCB) | `7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820` | CERN-OHL-P | 87,908 | `000882c19f01aa0e0374650ba216c81cae5b99b77fa9620ae9f3f0d94f62345b` |
| `simplefoc-mini.SchDoc` | [`simplefoc/SimpleFOCMini/simplefocmini_2024-04-26.schdoc`](https://github.com/simplefoc/SimpleFOCMini/blob/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.schdoc) | `8e10d4ba398624bd0ef970e82c03d7a6bcc2220d` | MIT | 83,458 | `bc2039ef59eabe030fea68eedb87e3924c8e6711fb774e2d80b880cf468100ef` |
| `simplefoc-shield-v3.SchDoc` | [`simplefoc/Arduino-SimpleFOCShield/SimpleFOCShieldV3.SchDoc_2024-06-23.schdoc`](https://github.com/simplefoc/Arduino-SimpleFOCShield/blob/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.SchDoc_2024-06-23.schdoc) | `2a83626b86debd5fc5f309ba06b3fb36e3b25533` | MIT | 235,809 | `84419ed6b8755c6490415cf3e439405d0d10a5855304db7ca8e8052f2add3af8` |
| `heron-systems-pcb.SchDoc` | [`utat-ss/HERON-pcbs/systems/systems_pcb/systems_pcb.SchDoc`](https://github.com/utat-ss/HERON-pcbs/blob/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/systems/systems_pcb/systems_pcb.SchDoc) | `7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820` | CERN-OHL-P | 180,736 | `2fd2d93806602a290cfc9afd7d523ac0f4faa8e5d993d70537f070e850fd6d6b` |
| `heron-systems-pcb.PrjPCB` | [`utat-ss/HERON-pcbs/systems/systems_pcb/systems_pcb.PrjPCB`](https://github.com/utat-ss/HERON-pcbs/blob/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/systems/systems_pcb/systems_pcb.PrjPCB) | `7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820` | CERN-OHL-P | 56,829 | `c4d7222c4e31eef1c6f1d8989d6cf9906bc5fc0c8f6fa51c4b9c82d5e538e5b9` |

The NodeMCU, EBAZ4205, SimpleFOC, Cobra, CH582, and quadcopter fixtures use the
MIT license. PiDP-11 I/O Expander uses BSD-2-Clause, and HERON uses CERN-OHL-P,
the permissive variant of the CERN Open Hardware Licence. No GPL or
reciprocal/copyleft fixture is included.

Each round-trip test uses only `altiumts` to parse and render the source file,
projects the primitives supported by the converter into Circuit JSON, converts
that Circuit JSON back to a native Altium file, and renders the result with
`altiumts`. Source and round-trip renderings are embedded unchanged, side by
side, in one SVG snapshot per file. Unsupported schematic constructs are not
synthesized by the fixture adapter, so their absence remains visible in the
snapshots.
