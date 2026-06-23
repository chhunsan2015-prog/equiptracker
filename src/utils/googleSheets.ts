/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyReport, StaffAssignment, Branch } from '../types.ts';
import { DEFAULT_BRANCHES } from '../constants.ts';

// Local storage keys
const STORAGE_REPORTS_KEY = 'tax_tracker_daily_reports';
const STORAGE_STAFF_KEY = 'tax_tracker_staff_assignments';
const STORAGE_SHEET_ID_KEY = 'tax_tracker_spreadsheet_id';

/**
 * Fallback Local Storage Methods
 */
export const getLocalReports = (): DailyReport[] => {
  const data = localStorage.getItem(STORAGE_REPORTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveLocalReports = (reports: DailyReport[]) => {
  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
};

export const getLocalStaff = (): StaffAssignment[] => {
  const data = localStorage.getItem(STORAGE_STAFF_KEY);
  let list: StaffAssignment[] = [];
  if (data) {
    try {
      list = JSON.parse(data);
    } catch {
      list = [];
    }
  }

  // Auto-verify and repair list to contain all current branches
  let isRepaired = false;
  const existingIds = new Set(list.map(s => s.branchId));

  DEFAULT_BRANCHES.forEach(b => {
    if (!existingIds.has(b.id)) {
      list.push({
        branchId: b.id,
        staffNames: b.defaultStaff,
      });
      isRepaired = true;
    }
  });

  if (isRepaired || !data) {
    localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(list));
  }
  return list;
};

export const saveLocalStaff = (staff: StaffAssignment[]) => {
  localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staff));
};

/**
 * Google Sheets API Integration Helpers
 */

interface SheetsAPIResponse {
  values?: string[][];
}

/**
 * Helper to fetch with Google Access Token
 */
async function sheetsFetch(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    let errMessage = 'Google Sheets API error';
    try {
      const parsed = JSON.parse(errText);
      errMessage = parsed.error?.message || errMessage;
    } catch {
      errMessage = errText || errMessage;
    }
    throw new Error(errMessage);
  }
  return response.json();
}

/**
 * Initialize a new Google Spreadsheet with StaffAssign and DailyReports sheets
 */
export async function createGoogleSpreadsheet(token: string): Promise<{ id: string, url: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: 'ប្រព័ន្ធតាមដានឧបករណ៍ និងការរាយការណ៍ - សាខាពន្ធដារ (Tax Branch Equipment Tracker)',
    },
    sheets: [
      {
        properties: {
          title: 'StaffAssign',
          gridProperties: { rowCount: 100, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'DailyReports',
          gridProperties: { rowCount: 20000, columnCount: 15 },
        },
      },
    ],
  };

  const response = await sheetsFetch(url, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const spreadsheetId = response.spreadsheetId;
  const spreadsheetUrl = response.spreadsheetUrl;

  // Initialize Headers for StaffAssign
  const staffHeaders = [
    ['Branch ID', 'Branch Name', 'Category', 'Technical Staff Names', 'Contact / Phone']
  ];
  const initialStaffRows = DEFAULT_BRANCHES.map(b => [
    b.id,
    b.nameKh,
    b.type === 'province' ? 'Province (ខេត្ត)' : 'Khan (ខណ្ឌ)',
    b.defaultStaff,
    '012 345 678', // placeholder contact
  ]);
  const staffData = [...staffHeaders, ...initialStaffRows];

  // Initialize Headers for DailyReports
  const reportHeaders = [
    ['Date', 'Branch ID', 'Branch Name', 'Status', 'Equipment Checked', 'Reporter Name', 'Telegram Post Time', 'Note', 'Logged At']
  ];

  // Write Staff Assignments
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/StaffAssign!A1:E${staffData.length}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ values: staffData }),
    }
  );

  // Write DailyReports headers
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DailyReports!A1:I1?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ values: reportHeaders }),
    }
  );

  // Style the spreadsheet (add basic freezing and formatting)
  try {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            // Freeze row 1 in both sheets
            {
              updateSheetProperties: {
                properties: {
                  sheetId: response.sheets[0].properties.sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: response.sheets[1].properties.sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // Bold Headers
            {
              repeatCell: {
                range: {
                  sheetId: response.sheets[0].properties.sheetId,
                  startRowIndex: 0, endRowIndex: 1,
                  startColumnIndex: 0, endColumnIndex: 5,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.85, green: 0.92, blue: 1.0 },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId: response.sheets[1].properties.sheetId,
                  startRowIndex: 0, endRowIndex: 1,
                  startColumnIndex: 0, endColumnIndex: 9,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.85, green: 0.92, blue: 1.0 },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
              },
            },
          ],
        }),
      }
    );
  } catch (styleErr) {
    console.error('Failed to apply professional spreadsheet styling:', styleErr);
  }

  // Save ID back to localStorage too
  localStorage.setItem(STORAGE_SHEET_ID_KEY, spreadsheetId);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Sync Local Staff assignments with Google Sheet
 */
export async function pullSettingsFromSheet(spreadsheetId: string, token: string): Promise<StaffAssignment[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/StaffAssign!A2:E200`;
  const response = (await sheetsFetch(url, token)) as SheetsAPIResponse;

  if (response.values && response.values.length > 0) {
    const list: StaffAssignment[] = response.values
      .filter(row => row && row[0]) // Ensure branchId is not empty
      .map(row => ({
        branchId: row[0],
        staffNames: row[3] || '',
        phone: row[4] || '',
      }));
    saveLocalStaff(list);
    return list;
  }
  return getLocalStaff();
}

/**
 * Push current local staff settings to Google Sheet
 */
export async function pushSettingsToSheet(spreadsheetId: string, token: string, staff: StaffAssignment[]): Promise<void> {
  // First clear the existing StaffAssign range to avoid obsolete trailing rows
  try {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/StaffAssign!A2:E200:clear`,
      token,
      {
        method: 'POST',
      }
    );
  } catch (clearErr) {
    console.warn('Failed to clear StaffAssign range prior to push:', clearErr);
  }

  const staffHeaders = [
    ['Branch ID', 'Branch Name', 'Category', 'Technical Staff Names', 'Contact / Phone']
  ];

  const rows = DEFAULT_BRANCHES.map(b => {
    const match = staff.find(s => s.branchId === b.id);
    return [
      b.id,
      b.nameKh,
      b.type === 'province' ? 'Province (ខេត្ត)' : 'Khan (ខណ្ឌ)',
      match ? match.staffNames : b.defaultStaff,
      match?.phone || '012 345 678',
    ];
  });

  const fullData = [...staffHeaders, ...rows];

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/StaffAssign!A1:E${fullData.length}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ values: fullData }),
    }
  );

  saveLocalStaff(staff);
}

/**
 * Fetch all reports from Google Sheet
 */
export async function pullReportsFromSheet(spreadsheetId: string, token: string): Promise<DailyReport[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DailyReports!A2:I100000`;
  const response = (await sheetsFetch(url, token)) as SheetsAPIResponse;

  if (response.values && response.values.length > 0) {
    const list: DailyReport[] = response.values
      .filter(row => row && row[0] && row[1]) // Ensure Date and Branch ID are present
      .map(row => {
        // Parse equipmentChecked
        const eqRaw = row[4] || '';
        const equipmentChecked = eqRaw ? eqRaw.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
        return {
          date: row[0],
          branchId: row[1],
          status: (row[3] === 'POSTED' || row[3] === 'NOT_POSTED') ? row[3] : 'POSTED',
          equipmentChecked,
          reporterName: row[5] || '',
          telegramPostTime: row[6] || '',
          note: row[7] || '',
          loggedAt: row[8] || new Date().toISOString(),
        };
      });
    saveLocalReports(list);
    return list;
  }
  return getLocalReports();
}

/**
 * Append or Update multiple reports in Google Sheet
 */
export async function saveReportsToSheet(
  spreadsheetId: string,
  token: string,
  reportsToSave: DailyReport[]
): Promise<void> {
  // Clear the existing DailyReports rows first to ensure no old trailing records
  try {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DailyReports!A2:I100000:clear`,
      token,
      {
        method: 'POST',
      }
    );
  } catch (clearErr) {
    console.warn('Failed to clear DailyReports range prior to push:', clearErr);
  }

  const headers = [
    ['Date', 'Branch ID', 'Branch Name', 'Status', 'Equipment Checked', 'Reporter Name', 'Telegram Post Time', 'Note', 'Logged At']
  ];

  // Merge the new/updated records with existing local state
  const currentLocal = getLocalReports();
  const updatedListMap = new Map<string, DailyReport>();

  // Add current ones
  currentLocal.forEach(r => {
    updatedListMap.set(`${r.date}_${r.branchId}`, r);
  });

  // Overwrite with newly saved/updated ones
  reportsToSave.forEach(r => {
    updatedListMap.set(`${r.date}_${r.branchId}`, r);
  });

  const mergedList = Array.from(updatedListMap.values());
  // Sort by date descending
  mergedList.sort((a, b) => b.date.localeCompare(a.date) || a.branchId.localeCompare(b.branchId));

  // Save to Local Storage first for immediate feedback
  saveLocalReports(mergedList);

  // Prepare sheet rows
  const rows = mergedList.map(r => {
    const branch = DEFAULT_BRANCHES.find(b => b.id === r.branchId);
    return [
      r.date,
      r.branchId,
      branch ? branch.nameKh : r.branchId,
      r.status,
      r.equipmentChecked.join(','),
      r.reporterName,
      r.telegramPostTime,
      r.note,
      r.loggedAt,
    ];
  });

  const fullData = [...headers, ...rows];

  // Write to Google Sheets
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DailyReports!A1:I${fullData.length}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ values: fullData }),
    }
  );
}
