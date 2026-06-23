/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Branch, Equipment } from './types.ts';

export const EQUIPMENT_LIST: Equipment[] = [
  { id: 'server_room', nameKh: 'បន្ទប់ម៉ាស៊ីនមេ (Server Room)', nameEn: 'Server Room', category: 'IT' },
  { id: 'video_conference', nameKh: 'ប្រព័ន្ធប្រជុំវីដេអូ (Video Conference)', nameEn: 'Video Conference', category: 'IT' },
  { id: 'qms_system', nameKh: 'ប្រព័ន្ធគ្រប់គ្រងជួររង់ចាំ (QMS System)', nameEn: 'QMS System', category: 'Queue' },
  { id: 'printer_458e', nameKh: 'ម៉ាស៊ីនព្រីន Bizhub 458e', nameEn: 'Printer Bizhub 458e', category: 'Printer' },
  { id: 'printer_450i', nameKh: 'ម៉ាស៊ីនព្រីន Bizhub 450i', nameEn: 'Printer Bizhub 450i', category: 'Printer' },
  { id: 'facescan', nameKh: 'ម៉ាស៊ីនស្កេនមុខ (FaceScan)', nameEn: 'FaceScan', category: 'Security' },
  { id: 'cctv', nameKh: 'កាមេរ៉ាសុវត្ថិភាព (CCTV)', nameEn: 'CCTV', category: 'Security' },
];

export const DEFAULT_BRANCHES: Branch[] = [
  // 24 Provinces
  { id: 'PROV_BMC', nameKh: 'បន្ទាយមានជ័យ', nameEn: 'Banteay Meanchey', type: 'province', defaultStaff: 'សុខ វិបុល' },
  { id: 'PROV_BBB', nameKh: 'បាត់ដំបង', nameEn: 'Battambang', type: 'province', defaultStaff: 'គង់ សុជាតិ' },
  { id: 'PROV_KPC', nameKh: 'កំពង់ចាម', nameEn: 'Kampong Cham', type: 'province', defaultStaff: 'ម៉ៅ សំណាង' },
  { id: 'PROV_KCH', nameKh: 'កំពង់ឆ្នាំង', nameEn: 'Kampong Chhnang', type: 'province', defaultStaff: 'លី វាសនា' },
  { id: 'PROV_KPS', nameKh: 'កំពង់ស្ពឺ', nameEn: 'Kampong Speu', type: 'province', defaultStaff: 'សេន ពិសិដ្ឋ' },
  { id: 'PROV_KPT', nameKh: 'កំពង់ធំ', nameEn: 'Kampong Thom', type: 'province', defaultStaff: 'តេង សារឿន' },
  { id: 'PROV_KAMP', nameKh: 'កំពត', nameEn: 'Kampot', type: 'province', defaultStaff: 'ភា រិទ្ធ' },
  { id: 'PROV_KND', nameKh: 'កណ្តាល', nameEn: 'Kandal', type: 'province', defaultStaff: 'ឈាង ឡុង' },
  { id: 'PROV_KKG', nameKh: 'កោះកុង', nameEn: 'Koh Kong', type: 'province', defaultStaff: 'ណាក់ វីរៈ' },
  { id: 'PROV_KRT', nameKh: 'ក្រចេះ', nameEn: 'Kratie', type: 'province', defaultStaff: 'អ៊ុំ ភក្តី' },
  { id: 'PROV_MDK', nameKh: 'មណ្ឌលគិរី', nameEn: 'Mondulkiri', type: 'province', defaultStaff: 'ស៊ន តារា' },
  { id: 'PROV_PVH', nameKh: 'ព្រះវិហារ', nameEn: 'Preah Vihear', type: 'province', defaultStaff: 'ឡៅ ម៉េងហួរ' },
  { id: 'PROV_PVG', nameKh: 'ព្រៃវែង', nameEn: 'Prey Veng', type: 'province', defaultStaff: 'កែវ សុខា' },
  { id: 'PROV_PST', nameKh: 'ពោធិ៍សាត់', nameEn: 'Pursat', type: 'province', defaultStaff: 'សុវណ្ណ តារា' },
  { id: 'PROV_RTK', nameKh: 'រតនគិរី', nameEn: 'Ratanakiri', type: 'province', defaultStaff: 'ហេង ណារ៉ុង' },
  { id: 'PROV_SRP', nameKh: 'សៀមរាប', nameEn: 'Siem Reap', type: 'province', defaultStaff: 'យ៉ែន យុទ្ធ' },
  { id: 'PROV_SHV', nameKh: 'ព្រះសីហនុ', nameEn: 'Preah Sihanouk', type: 'province', defaultStaff: 'ខៀវ សារ៉ាត់' },
  { id: 'PROV_STG', nameKh: 'ស្ទឹងត្រែង', nameEn: 'Stung Treng', type: 'province', defaultStaff: 'ពៅ ចំរើន' },
  { id: 'PROV_SVR', nameKh: 'ស្វាយរៀង', nameEn: 'Svay Rieng', type: 'province', defaultStaff: 'ស៊ឹម សុភ័ក្រ' },
  { id: 'PROV_TKO', nameKh: 'តាកែវ', nameEn: 'Takeo', type: 'province', defaultStaff: 'ម៉ៅ វាសនា' },
  { id: 'PROV_OMC', nameKh: 'ឧត្តរមានជ័យ', nameEn: 'Oddar Meanchey', type: 'province', defaultStaff: 'ហាក់ សេងលី' },
  { id: 'PROV_KEP', nameKh: 'កែប', nameEn: 'Kep', type: 'province', defaultStaff: 'ភឿន វុទ្ធី' },
  { id: 'PROV_PLN', nameKh: 'ប៉ៃលិន', nameEn: 'Pailin', type: 'province', defaultStaff: 'ញ៉ែម សុផាត' },
  { id: 'PROV_TBK', nameKh: 'ត្បូងឃ្មុំ', nameEn: 'Tboung Khmum', type: 'province', defaultStaff: 'ជឿន ចាន់ត្រា' },

  // 9 Khans
  { id: 'KHAN_7M', nameKh: '៧មករា', nameEn: 'Khan Prampi Makara', type: 'khan', defaultStaff: 'អ៊ុំ រតនា' },
  { id: 'KHAN_CM', nameKh: 'ចំការមន', nameEn: 'Khan Chamkar Mon', type: 'khan', defaultStaff: 'សួន វណ្ណា' },
  { id: 'KHAN_DK', nameKh: 'ដង្កោ', nameEn: 'Khan Dangkao', type: 'khan', defaultStaff: 'សុខ គឹមហៀង' },
  { id: 'KHAN_DP', nameKh: 'ដូនពេញ', nameEn: 'Khan Daun Penh', type: 'khan', defaultStaff: 'លឹម ម៉េងហុង' },
  { id: 'KHAN_TK', nameKh: 'ទួលគោក', nameEn: 'Khan Tuol Kork', type: 'khan', defaultStaff: 'គីម ហុង' },
  { id: 'KHAN_PSC', nameKh: 'ពោធិ៍សែនជ័យ', nameEn: 'Khan Pou Senchey', type: 'khan', defaultStaff: 'ចាន់ មុនីឌី' },
  { id: 'KHAN_RK', nameKh: 'ឫស្សីកែវ', nameEn: 'Khan Russey Keo', type: 'khan', defaultStaff: 'ជា សុភ័ក្ត្រ' },
  { id: 'KHAN_SS', nameKh: 'សែនសុខ', nameEn: 'Khan Sen Sok', type: 'khan', defaultStaff: 'លឹម សុធារ៉ា' },
  { id: 'KHAN_MC', nameKh: 'មានជ័យ', nameEn: 'Khan Meanchey', type: 'khan', defaultStaff: 'សេង ពិសិដ្ឋ' },
];
