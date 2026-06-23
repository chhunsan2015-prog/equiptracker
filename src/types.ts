/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BranchType = 'province' | 'khan';

export interface Branch {
  id: string;
  nameKh: string;
  nameEn: string;
  type: BranchType;
  defaultStaff: string;
}

export interface StaffAssignment {
  branchId: string;
  staffNames: string;
  phone?: string;
}

export interface Equipment {
  id: string;
  nameKh: string;
  nameEn: string;
  category: string;
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  branchId: string;
  status: 'POSTED' | 'NOT_POSTED';
  equipmentChecked: string[]; // List of equipment IDs
  reporterName: string;
  telegramPostTime: string; // e.g. "09:30"
  note: string;
  loggedAt: string; // ISO string
}

export interface SheetConnectionState {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  connectedAt: string | null;
  isLoading: boolean;
  error: string | null;
}
