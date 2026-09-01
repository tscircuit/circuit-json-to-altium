import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

type ReferenceSpec = {
  filename: string
  sha256: string
  source: string
  url: string
}

const references: ReferenceSpec[] = [
  {
    filename: "nodemcu-esp12.PcbDoc",
    sha256: "5060fb6f0e80af09c8d5af376038a4e55044b28ae1d4dfa6a1fa354a6ea1e2f2",
    source:
      "nodemcu/nodemcu-devkit@b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce (MIT)",
    url: "https://raw.githubusercontent.com/nodemcu/nodemcu-devkit/b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce/NODEMCU_ESP12.PcbDoc",
  },
  {
    filename: "nodemcu-esp12.SchDoc",
    sha256: "cd415e8afcc7b47f2a0d7acf1e3a41d2304c4c4f02a70744d710ce24ba09707d",
    source:
      "nodemcu/nodemcu-devkit@b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce (MIT)",
    url: "https://raw.githubusercontent.com/nodemcu/nodemcu-devkit/b0f19d6d1c49b6db4aef56ddba789a7f92f6ecce/NODEMCU_ESP12.SchDoc",
  },
  {
    filename: "ebaz4205.PcbDoc",
    sha256: "1dbeba2537bdf83e77bc9c5a7a6f2f7bf1104193f3dc2547d020dbd8018b4e62",
    source: "xjtuecho/EBAZ4205@05cdb45035a06fc5b4db16babf0ac6f4ee4497be (MIT)",
    url: "https://raw.githubusercontent.com/xjtuecho/EBAZ4205/05cdb45035a06fc5b4db16babf0ac6f4ee4497be/HW/ebaz4205/altium/ebit_ad.PcbDoc",
  },
  {
    filename: "heron-payload-ssm.PcbDoc",
    sha256: "47a72219ab21c8eebb5beeab97e8aeca2121efb8561fca1d5f732215d233575d",
    source:
      "utat-ss/HERON-pcbs@7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820 (CERN-OHL-P)",
    url: "https://raw.githubusercontent.com/utat-ss/HERON-pcbs/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/pay-ssm-v3.PcbDoc",
  },
  {
    filename: "heron-pay-ssm-top.SchDoc",
    sha256: "948eca8d0b9e306909755c11ad94d84eda7e60164d7ecc848dfbe8b77cdc2903",
    source:
      "utat-ss/HERON-pcbs@7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820 (CERN-OHL-P)",
    url: "https://raw.githubusercontent.com/utat-ss/HERON-pcbs/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/TOP.SchDoc",
  },
  {
    filename: "heron-pay-ssm.PrjPCB",
    sha256: "000882c19f01aa0e0374650ba216c81cae5b99b77fa9620ae9f3f0d94f62345b",
    source:
      "utat-ss/HERON-pcbs@7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820 (CERN-OHL-P)",
    url: "https://raw.githubusercontent.com/utat-ss/HERON-pcbs/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/payload/pay-ssm/pay-ssm.PrjPCB",
  },
  {
    filename: "heron-systems-pcb.SchDoc",
    sha256: "2fd2d93806602a290cfc9afd7d523ac0f4faa8e5d993d70537f070e850fd6d6b",
    source:
      "utat-ss/HERON-pcbs@7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820 (CERN-OHL-P)",
    url: "https://raw.githubusercontent.com/utat-ss/HERON-pcbs/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/systems/systems_pcb/systems_pcb.SchDoc",
  },
  {
    filename: "heron-systems-pcb.PrjPCB",
    sha256: "c4d7222c4e31eef1c6f1d8989d6cf9906bc5fc0c8f6fa51c4b9c82d5e538e5b9",
    source:
      "utat-ss/HERON-pcbs@7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820 (CERN-OHL-P)",
    url: "https://raw.githubusercontent.com/utat-ss/HERON-pcbs/7ce0d62ee6159ad9d74eb4ae941792dc0e2e4820/systems/systems_pcb/systems_pcb.PrjPCB",
  },
  {
    filename: "simplefoc-mini.PcbDoc",
    sha256: "8328cebe97ba8623fb2b707490e3473c6f7dc13fb0502b596b0e40c7e1613d24",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.pcbdoc",
  },
  {
    filename: "simplefoc-mini.SchDoc",
    sha256: "bc2039ef59eabe030fea68eedb87e3924c8e6711fb774e2d80b880cf468100ef",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.schdoc",
  },
  {
    filename: "simplefoc-shield-v3.PcbDoc",
    sha256: "507a0feb04cf539edd110ff1fe6da8ca8025009140b1934a6fc4df78308bfec5",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.PcbDoc_2024-06-23.pcbdoc",
  },
  {
    filename: "simplefoc-shield-v3.SchDoc",
    sha256: "84419ed6b8755c6490415cf3e439405d0d10a5855304db7ca8e8052f2add3af8",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.SchDoc_2024-06-23.schdoc",
  },
  {
    filename: "simplefoc-stepmini.PcbDoc",
    sha256: "1b8384490277d89b499a7a5963ed29bd0cf548ec8d50fe0354f242cf3148ee02",
    source:
      "simplefoc/SimpleFOC-StepMini@5795cb31faceba53602c9b6bb3b50872cde26345 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOC-StepMini/5795cb31faceba53602c9b6bb3b50872cde26345/Altium/simplefoc-stepmini_2024-05-25.pcbdoc",
  },
  {
    filename: "pidp11-io-expander.PcbDoc",
    sha256: "1ff7234670ec5e20092d23ecf0cd5e7380e842ef7efff2b5cb992f53f84c9c69",
    source:
      "sstallion/PCB-PiDP11IOExpander@d97b81645091da8404661b37f75e4872c1788f79 (BSD-2-Clause)",
    url: "https://media.githubusercontent.com/media/sstallion/PCB-PiDP11IOExpander/d97b81645091da8404661b37f75e4872c1788f79/PiDP11IOExpander.PcbDoc",
  },
  {
    filename: "cobra.PcbDoc",
    sha256: "d0913643166660cfdcc5490d63283b12f4ff08b0dbbaa05e409a9cd9196aa9c5",
    source: "pengwon/cobra@1347008d7985d8c3dbecc3d81e4bf4e1ace2c33d (MIT)",
    url: "https://media.githubusercontent.com/media/pengwon/cobra/1347008d7985d8c3dbecc3d81e4bf4e1ace2c33d/hw/pcb/cobra.PcbDoc",
  },
  {
    filename: "ch582.PcbDoc",
    sha256: "dcf82249e19f9a58f3874e9c56509bab42f3fdf00dc3dd0d52ba9a4f4aeb0649",
    source:
      "iot-lorawan/CH582_PCB_SCH@b65bce802295c6c40413c5bc3ea54682820619c1 (MIT)",
    url: "https://raw.githubusercontent.com/iot-lorawan/CH582_PCB_SCH/b65bce802295c6c40413c5bc3ea54682820619c1/PCB_ch582_2022-06-16.pcbdoc",
  },
  {
    filename: "quadcopter-controller.PcbDoc",
    sha256: "6d9ea33155ea5fd68942e57f94003110497ca0e16af616e941fe7c25513faea6",
    source:
      "jdekarske/Quadcopter@b4285601a1ea73d0453a2065c9580b026611e01c (MIT)",
    url: "https://raw.githubusercontent.com/jdekarske/Quadcopter/b4285601a1ea73d0453a2065c9580b026611e01c/PCB/fororder.PcbDoc",
  },
]

const referencesDirectory = resolve(import.meta.dir, "..", "references")

async function downloadReference(reference: ReferenceSpec): Promise<void> {
  const response = await fetch(reference.url)
  if (!response.ok) {
    throw new Error(
      `${reference.url} (${response.status} ${response.statusText})`,
    )
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const actualHash = createHash("sha256").update(bytes).digest("hex")
  if (actualHash !== reference.sha256) {
    throw new Error(
      `${reference.filename} SHA-256 mismatch: expected ${reference.sha256}, got ${actualHash}`,
    )
  }

  await writeFile(resolve(referencesDirectory, reference.filename), bytes)
  console.log(
    `Saved ${reference.filename} (${bytes.byteLength} bytes) from ${reference.source}`,
  )
}

await mkdir(referencesDirectory, { recursive: true })
await Promise.all(references.map(downloadReference))
