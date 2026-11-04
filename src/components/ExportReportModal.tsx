/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { Branch, DailyReport, StaffAssignment } from '../types.ts';
import { FileSpreadsheet, Printer, X, Check, Award, AlertCircle, FileText, Download } from 'lucide-react';
import { getWorkingDaysInMonth } from '../constants.ts';
import gdtLogoUrl from '../gdtlogo.png';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  branches: Branch[];
  reports: DailyReport[];
  staff: StaffAssignment[];
}

export default function ExportReportModal({
  isOpen,
  onClose,
  selectedMonth,
  branches,
  reports,
  staff,
}: ExportReportModalProps) {
  if (!isOpen) return null;

  // Extract year and month
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Generate list of dates in the month
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, '0');
    return `${selectedMonth}-${dayStr}`;
  });

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Helper code to map reports
  const reportLookup: Record<string, DailyReport> = {};
  reports.forEach(r => {
    reportLookup[`${r.date}_${r.branchId}`] = r;
  });

  // Calculate statistics for the report preview
  const totalWorkingDays = getWorkingDaysInMonth(year, month);
  let totalPostedCount = 0;

  const branchReportsSummary = branches.map(b => {
    const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
    let posted = 0;

    dates.forEach(dateStr => {
      const [y, m, dNum] = dateStr.split('-').map(Number);
      const dObj = new Date(y, m - 1, dNum);
      const dayOfWeek = dObj.getDay();
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) return;

      if (dateStr <= todayStr) {
        const r = reportLookup[`${dateStr}_${b.id}`];
        if (r && r.status === 'POSTED') {
          posted++;
        }
      }
    });

    const rate = totalWorkingDays > 0 ? Math.round((posted / totalWorkingDays) * 100) : 0;
    
    totalPostedCount += posted;

    return {
      branchName: b.nameKh,
      branchEn: b.nameEn,
      staff: bStaff,
      posted,
      total: totalWorkingDays,
      rate,
    };
  });

  const totalValidDays = branches.length * totalWorkingDays;
  const overallRate = totalValidDays > 0 ? Math.round((totalPostedCount / totalValidDays) * 100) : 0;

  // Outstanding branches (100% rate)
  const outstandingBranches = branchReportsSummary.filter(b => b.rate === 100);
  // Branches needing attention (< 60% rate)
  const attentionBranches = branchReportsSummary.filter(b => b.rate < 60);

  /**
   * Action function: Export grid to a clean and styled Excel (.xlsx) file using xlsx-js-style + embedded GDT Logo
   */
  const handleDownloadCSV = async () => {
    try {
      // Rearrange branches so that OMC, KRT, KEP, PST, PLN are at the very bottom rows
      const bottomBranchIds = ['PROV_OMC', 'PROV_KRT', 'PROV_KEP', 'PROV_PST', 'PROV_PLN'];
      const bottomBranchesList = branches.filter(b => bottomBranchIds.includes(b.id));
      const otherBranches = branches.filter(b => !bottomBranchIds.includes(b.id));

      // Sort the bottom branches to match the exact order: Oddar Meanchey, Kratie, Kep, Pursat, Pailin
      bottomBranchesList.sort((a, b) => {
        return bottomBranchIds.indexOf(a.id) - bottomBranchIds.indexOf(b.id);
      });

      const sortedBranchesForExcel = [...otherBranches, ...bottomBranchesList];

      // Format current date to Khmer characters
      const khmerMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];
      const khmerMonthName = khmerMonths[month - 1] || '';

      const khmerNumbers = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
      const toKhmerNumber = (num: number | string) => {
        return String(num).split('').map(char => {
          const idx = parseInt(char, 10);
          return isNaN(idx) ? char : khmerNumbers[idx];
        }).join('');
      };

      const currentDate = new Date();
      const khmerDay = toKhmerNumber(currentDate.getDate());
      const khmerYear = toKhmerNumber(currentDate.getFullYear());
      const khmerMonthNameToday = khmerMonths[currentDate.getMonth()];

      // Create new Workbook & Worksheet using xlsx-js-style
      const wb = XLSX.utils.book_new();
      const ws: Record<string, any> = {};

      const setCell = (col: number, row: number, value: any, style: any = {}, type: string = 's') => {
        const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
        ws[cellRef] = {
          v: value,
          t: type,
          s: {
            font: { name: 'Khmer OS Siemreap', sz: 10, ...style.font },
            alignment: { vertical: 'center', ...style.alignment },
            fill: style.fill || undefined,
            border: style.border || undefined,
          }
        };
      };

      const rateColIndex = 2 + daysInMonth;
      const rightStartCol = Math.max(18, rateColIndex - 6);

      // White background fill (no borders) for all Header rows (Rows 0 to 6) to hide default Excel gridlines
      const headerWhiteFill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FFFFFF' } };
      for (let r = 0; r <= 6; r++) {
        for (let c = 0; c <= rateColIndex; c++) {
          setCell(c, r, "", {
            fill: headerWhiteFill,
            alignment: { horizontal: 'center', vertical: 'center' }
          });
        }
      }

      // =========================================================================
      // 1. TOP OFFICIAL HEADER (Rows 0, 1, 2, 3)
      // =========================================================================
      // Left Section (3 Lines, Merged A1:D1, A2:D2, A3:D3, Aligned Center)
      setCell(0, 0, "អគ្គនាយកដ្ឋានពន្ធដារ", {
        fill: headerWhiteFill,
        font: { sz: 11, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      setCell(0, 1, "នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន", {
        fill: headerWhiteFill,
        font: { sz: 10.5, bold: true, underline: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      setCell(0, 2, "ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន", {
        fill: headerWhiteFill,
        font: { sz: 10, bold: false, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Right Section (2 Lines + Ornamental Underline, Merged & Aligned Center)
      setCell(rightStartCol, 0, "ព្រះរាជាណាចក្រកម្ពុជា", {
        fill: headerWhiteFill,
        font: { sz: 12, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      setCell(rightStartCol, 1, "ជាតិ សាសនា ព្រះមហាក្សត្រ", {
        fill: headerWhiteFill,
        font: { sz: 11, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      setCell(rightStartCol, 2, "────────── ❖ ──────────", {
        fill: headerWhiteFill,
        font: { sz: 9.5, bold: true, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Row 3: Dedicated full-width centered Logo row directly above Report Title
      setCell(0, 3, "", {
        fill: headerWhiteFill,
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // =========================================================================
      // 2. REPORT TITLE & SUBTITLE (Rows 4 & 5 - Merged Full Width & Centered)
      // =========================================================================
      setCell(0, 4, "របាយការណ៍សង្ខេបស្តីពី ការត្រួតពិនិត្យឧបករណ៍ប្រចាំថ្ងៃ", {
        fill: headerWhiteFill,
        font: { sz: 15, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      setCell(0, 5, `ប្រចាំខែ ${khmerMonthName} ឆ្នាំ ${year}`, {
        fill: headerWhiteFill,
        font: { sz: 11.5, bold: true, color: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // =========================================================================
      // 3. SUB-TITLE ROW (Row 6 - Above Table)
      // =========================================================================
      setCell(0, 6, "Telegram Group: ITS-SITE-SUPPORT-TEAM", {
        fill: headerWhiteFill,
        font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      });

      // Borders config
      const tableBorder = {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } }
      };

      // Header style
      const mainHeaderStyle = {
        fill: { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        font: { sz: 10.5, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: tableBorder
      };

      const weekdayHeaderStyle = {
        fill: { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
        font: { sz: 9, bold: true, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: tableBorder
      };

      const weekendHeaderStyle = {
        fill: { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
        font: { sz: 9, bold: true, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: tableBorder
      };

      // =========================================================================
      // 4. TABLE HEADERS (Row index 7 and Row index 8)
      // =========================================================================
      const tableHeaderRow = 7;
      const tableSubHeaderRow = 8;
      const dataStartRow = 9;

      setCell(0, tableHeaderRow, "សាខាពន្ធដារ", mainHeaderStyle);
      setCell(0, tableSubHeaderRow, "", mainHeaderStyle);

      setCell(1, tableHeaderRow, "មន្ត្រីបច្ចេកទេស", mainHeaderStyle);
      setCell(1, tableSubHeaderRow, "", mainHeaderStyle);

      // Write Day Headers
      for (let i = 0; i < daysInMonth; i++) {
        const colIndex = 2 + i;
        const dayNum = i + 1;
        const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
        const [y, m, dNum] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, dNum);
        const dayOfWeek = dObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSaturday = dayOfWeek === 6;

        const dayStyle = isWeekend ? weekendHeaderStyle : weekdayHeaderStyle;
        const weekendIndicator = isWeekend ? (isSaturday ? 'ស' : 'អ') : '';

        setCell(colIndex, tableHeaderRow, dayNum, dayStyle);
        setCell(colIndex, tableSubHeaderRow, weekendIndicator, dayStyle);
      }

      setCell(rateColIndex, tableHeaderRow, "អត្រា Post", mainHeaderStyle);
      setCell(rateColIndex, tableSubHeaderRow, "", mainHeaderStyle);

      // Initialize merges list
      const merges = [
        // Top Header Left (Rows 0, 1, 2 -> Merged across 4 columns: A1:D1, A2:D2, A3:D3)
        { s: { c: 0, r: 0 }, e: { c: 3, r: 0 } },
        { s: { c: 0, r: 1 }, e: { c: 3, r: 1 } },
        { s: { c: 0, r: 2 }, e: { c: 3, r: 2 } },
        // Top Header Center (Rows 0-2 between Left & Right blocks)
        { s: { c: 4, r: 0 }, e: { c: rightStartCol - 1, r: 2 } },
        // Top Header Right (Rows 0, 1, 2 -> Merged across right columns & centered)
        { s: { c: rightStartCol, r: 0 }, e: { c: rateColIndex, r: 0 } },
        { s: { c: rightStartCol, r: 1 }, e: { c: rateColIndex, r: 1 } },
        { s: { c: rightStartCol, r: 2 }, e: { c: rateColIndex, r: 2 } },
        // Logo Row (Row 3 -> Merged Full Width from Column 0 to Last Column, matching Title rows)
        { s: { c: 0, r: 3 }, e: { c: rateColIndex, r: 3 } },
        // Report Title & Subtitle (Rows 4 & 5 -> Merged Full Width from Column 0 to Last Column)
        { s: { c: 0, r: 4 }, e: { c: rateColIndex, r: 4 } },
        { s: { c: 0, r: 5 }, e: { c: rateColIndex, r: 5 } },
        // Telegram Group Sub-title (Row 6)
        { s: { c: 0, r: 6 }, e: { c: 5, r: 6 } },
        // Table Headers (Rows 7 & 8)
        { s: { c: 0, r: tableHeaderRow }, e: { c: 0, r: tableSubHeaderRow } }, // branch header
        { s: { c: 1, r: tableHeaderRow }, e: { c: 1, r: tableSubHeaderRow } }, // staff header
        { s: { c: rateColIndex, r: tableHeaderRow }, e: { c: rateColIndex, r: tableSubHeaderRow } }, // rate header
      ];

      // Write table rows (Row index dataStartRow onwards)
      sortedBranchesForExcel.forEach((b, bIdx) => {
        const rowIndex = dataStartRow + bIdx;
        const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
        let postedCount = 0;

        // Column A: Branch Name
        setCell(0, rowIndex, b.nameKh, {
          font: { sz: 11, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
          border: tableBorder
        });

        // Column B: Technical Staff Name
        setCell(1, rowIndex, bStaff, {
          font: { sz: 9.5, color: { rgb: '334155' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: tableBorder
        });

        // Columns C to C+daysInMonth-1: Day cell values
        dates.forEach((dateStr, dIdx) => {
          const colIndex = 2 + dIdx;
          const [y, m, dNum] = dateStr.split('-').map(Number);
          const dObj = new Date(y, m - 1, dNum);
          const dayOfWeek = dObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const r = reportLookup[`${dateStr}_${b.id}`];
          const hasReport = !!r;
          const isPosted = hasReport && r.status === 'POSTED';
          const remarkText = (r?.remark || r?.note || '')
            .replace(/^\[REMARK:(.*?)\]\s*/s, '$1')
            .trim();
          const hasRemark = remarkText !== '' && remarkText !== 'ធម្មតា';

          if (dateStr <= todayStr && !isWeekend && isPosted) {
            postedCount++;
          }

          let cellVal = "";
          let fill: any = undefined;
          let font: any = { sz: 9, color: { rgb: '000000' } };

          if (hasRemark) {
            cellVal = remarkText;
            fill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FEE2E2' } };
            font = { sz: 9, bold: true, color: { rgb: 'DC2626' } };
          } else if (dateStr <= todayStr) {
            if (isWeekend) {
              if (isPosted) {
                cellVal = "✔";
                fill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'D1FAE5' } };
                font = { sz: 11, bold: true, color: { rgb: '065F46' } };
              } else {
                cellVal = "ស-អ";
                fill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'F8FAFC' } };
                font = { sz: 8.5, color: { rgb: '94A3B8' } };
              }
            } else {
              if (isPosted) {
                cellVal = "✔";
                fill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'D1FAE5' } };
                font = { sz: 11, bold: true, color: { rgb: '065F46' } };
              } else if (hasReport && r.status === 'NOT_POSTED') {
                cellVal = "✘";
                fill = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FEE2E2' } };
                font = { sz: 11, bold: true, color: { rgb: '991B1B' } };
              } else {
                cellVal = "";
              }
            }
          } else {
            cellVal = "-";
            font = { sz: 9, color: { rgb: 'CBD5E1' } };
          }

          setCell(colIndex, rowIndex, cellVal, {
            font,
            fill,
            alignment: { horizontal: 'center', vertical: 'center' },
            border: tableBorder
          });
        });

        // Column Rate: Completion Rate
        const rate = totalWorkingDays > 0 ? Math.round((postedCount / totalWorkingDays) * 100) : 0;
        let fillRate = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FFE4E6' } }; // Soft light rose background (rose-100)
        let fontRate = { sz: 9.5, bold: true, color: { rgb: '9F1239' } }; // Dark red text (rose-800)

        if (rate >= 90) {
          fillRate = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'D1FAE5' } }; // Soft light green background (emerald-100)
          fontRate = { sz: 9.5, bold: true, color: { rgb: '065F46' } }; // Dark green text (emerald-800)
        } else if (rate >= 60) {
          fillRate = { type: 'pattern', patternType: 'solid', fgColor: { rgb: 'FEF3C7' } }; // Soft light yellow background (amber-100)
          fontRate = { sz: 9.5, bold: true, color: { rgb: '92400E' } }; // Dark orange/brown text (amber-800)
        }

        setCell(rateColIndex, rowIndex, `${rate}%\n(${postedCount}/${totalWorkingDays} ថ្ងៃ)`, {
          font: fontRate,
          fill: fillRate,
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: tableBorder
        });
      });

      // Write Signature and Date Table
      const footerRowStart = dataStartRow + sortedBranchesForExcel.length + 2;

      // "ធ្វើនៅភ្នំពេញ, ថ្ងៃទី..." at footerRowStart
      const footerText = `ធ្វើនៅភ្នំពេញ, ថ្ងៃទី ${khmerDay} ខែ ${khmerMonthNameToday} ឆ្នាំ ${khmerYear}`;
      const signColStart = Math.max(0, rateColIndex - 8);
      
      merges.push({ s: { c: signColStart, r: footerRowStart }, e: { c: rateColIndex, r: footerRowStart } });
      setCell(signColStart, footerRowStart, footerText, {
        font: { sz: 10, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // "អ្នករៀបចំរបាយការណ៍" at footerRowStart + 1
      merges.push({ s: { c: signColStart, r: footerRowStart + 1 }, e: { c: rateColIndex, r: footerRowStart + 1 } });
      setCell(signColStart, footerRowStart + 1, "អ្នករៀបចំរបាយការណ៍", {
        font: { sz: 11, bold: true, color: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // "......................................................" at footerRowStart + 4
      merges.push({ s: { c: signColStart, r: footerRowStart + 4 }, e: { c: rateColIndex, r: footerRowStart + 4 } });
      setCell(signColStart, footerRowStart + 4, "......................................................", {
        font: { sz: 10, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Set worksheets properties
      ws['!merges'] = merges;
      
      // Column Widths
      const colWidths = [
        { wch: 25 }, // Column A: សាខាពន្ធដារ
        { wch: 18 }, // Column B: មន្ត្រីបច្ចេកទេស
      ];
      for (let i = 0; i < daysInMonth; i++) {
        colWidths.push({ wch: 4.8 }); // Days columns
      }
      colWidths.push({ wch: 20 }); // Rate Column
      ws['!cols'] = colWidths;

      // Row Heights
      const rowHeights = [
        { hpt: 22 }, // Row 0 (Official Header Line 1)
        { hpt: 20 }, // Row 1 (Official Header Line 2)
        { hpt: 20 }, // Row 2 (Official Header Line 3)
        { hpt: 18 }, // Row 3 (Logo bottom spacing)
        { hpt: 28 }, // Row 4 (Report Title)
        { hpt: 22 }, // Row 5 (Report Subtitle)
        { hpt: 20 }, // Row 6 (Telegram Group Sub-title)
        { hpt: 22 }, // Row 7 (Table Header Row 1)
        { hpt: 18 }, // Row 8 (Table Header Row 2)
      ];
      for (let i = 0; i < sortedBranchesForExcel.length; i++) {
        rowHeights.push({ hpt: 38, hpx: 48 }); // Branch rows - taller height for 2-line Khmer text in Rate column
      }
      ws['!rows'] = rowHeights;

      // Define worksheet range
      const lastColLetter = XLSX.utils.encode_col(rateColIndex);
      const lastRowNumber = footerRowStart + 6;
      ws['!ref'] = `A1:${lastColLetter}${lastRowNumber}`;

      // Append sheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "របាយការណ៍សង្ខេប");

      const fileName = `Daily_Equipment_Report_Summary_${selectedMonth}.xlsx`;

      // =========================================================================
      // 5. EMBED GDT LOGO (gdtlogo.png) INTO EXACT HORIZONTAL CENTER OF TABLE
      // =========================================================================
      try {
        const xlsxArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const zip = await JSZip.loadAsync(xlsxArrayBuffer);
        const logoResponse = await fetch(gdtLogoUrl);
        const logoBuffer = await logoResponse.arrayBuffer();

        // Add logo image binary to xl/media/image1.png
        zip.file('xl/media/image1.png', logoBuffer);

        // Compute exact pixel width of the full table (Column 0 to rateColIndex)
        // so the 105px-wide GDT logo is centered at the exact same horizontal midpoint
        // as the full-width merged Report Title & Subtitle rows (A to lastColLetter).
        const logoWidthPx = 105;
        const logoHeightPx = 82;
        const colPxList = colWidths.map(cw => cw.wch * 7.5 + 6);
        const totalTablePx = colPxList.reduce((sum, px) => sum + px, 0);
        const targetLogoLeftPx = (totalTablePx - logoWidthPx) / 2;

        let accumulatedPx = 0;
        let logoCenterCol = 0;
        let logoColOffsetPx = 0;
        for (let c = 0; c < colPxList.length; c++) {
          if (accumulatedPx + colPxList[c] > targetLogoLeftPx) {
            logoCenterCol = c;
            logoColOffsetPx = targetLogoLeftPx - accumulatedPx;
            break;
          }
          accumulatedPx += colPxList[c];
        }

        const widthEmu = logoWidthPx * 9525;
        const heightEmu = logoHeightPx * 9525;
        const colOffEmu = Math.round(logoColOffsetPx * 9525);
        const rowOffEmu = 4 * 9525;

        const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>${logoCenterCol}</xdr:col>
      <xdr:colOff>${colOffEmu}</xdr:colOff>
      <xdr:row>0</xdr:row>
      <xdr:rowOff>${rowOffEmu}</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="${widthEmu}" cy="${heightEmu}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="GDT Logo"/>
        <xdr:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;

        const drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

        const sheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

        zip.file('xl/drawings/drawing1.xml', drawingXml);
        zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRelsXml);
        zip.file('xl/worksheets/_rels/sheet1.xml.rels', sheetRelsXml);

        // Register drawing1.xml in [Content_Types].xml
        const contentTypesFile = zip.file('[Content_Types].xml');
        if (contentTypesFile) {
          let contentTypesXml = await contentTypesFile.async('string');
          if (!contentTypesXml.includes('/xl/drawings/drawing1.xml')) {
            contentTypesXml = contentTypesXml.replace(
              '</Types>',
              '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'
            );
            zip.file('[Content_Types].xml', contentTypesXml);
          }
        }

        // Link drawing rId1 in xl/worksheets/sheet1.xml
        const sheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (sheetFile) {
          let sheetXml = await sheetFile.async('string');
          if (!sheetXml.includes('<drawing ')) {
            sheetXml = sheetXml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>');
            zip.file('xl/worksheets/sheet1.xml', sheetXml);
          }
        }

        const finalBlob = await zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const downloadUrl = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } catch (logoErr) {
        console.warn('Fallback to standard XLSX write without logo:', logoErr);
        XLSX.writeFile(wb, fileName);
      }
    } catch (e) {
      alert('កំហុសពេលទាញយក Excel៖ ' + String(e));
    }
  };

  /**
   * Action function: Print / Save report as PDF
   */
  const handlePrintPDF = () => {
    window.print();
  };

  // Prepare data for the printable PDF layout (matching the official GDT monthly report)
  const khmerMonthsList = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
  ];
  const khmerMonthNameForPrint = khmerMonthsList[month - 1] || '';
  const khmerNumbersList = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  const toKhmerNumberForPrint = (num: number | string) =>
    String(num).split('').map(c => {
      const idx = parseInt(c, 10);
      return isNaN(idx) ? c : khmerNumbersList[idx];
    }).join('');
  const nowDate = new Date();
  const printDayKh = toKhmerNumberForPrint(nowDate.getDate());
  const printMonthKh = khmerMonthsList[nowDate.getMonth()];
  const printYearKh = toKhmerNumberForPrint(nowDate.getFullYear());

  const bottomIdsForPrint = ['PROV_OMC', 'PROV_KRT', 'PROV_KEP', 'PROV_PST', 'PROV_PLN'];
  const sortedBranchesForPrint = [
    ...branches.filter(b => !bottomIdsForPrint.includes(b.id)),
    ...branches
      .filter(b => bottomIdsForPrint.includes(b.id))
      .sort((a, b) => bottomIdsForPrint.indexOf(a.id) - bottomIdsForPrint.indexOf(b.id))
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] print:hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">ទាញយករបាយការណ៍សង្ខេបប្រចាំខែ (Monthly Report Export)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ទាញយកទិន្នន័យប្រចាំខែ <strong className="text-emerald-700">{selectedMonth}</strong> ទៅជា Excel/CSV ឬបោះពុម្ពជា PDF។
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition print:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Performance Overview Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total rate card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-100/50 text-emerald-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">អត្រាសម្រេចរួម</span>
                <span className="text-xl font-bold font-mono text-emerald-700">{overallRate}%</span>
                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">({totalPostedCount}/{totalValidDays} ថ្ងៃគ្របដណ្តប់)</span>
              </div>
            </div>

            {/* Top Branches card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
              <div className="p-2.5 bg-amber-100/50 text-amber-700 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">សាខាបំពេញបាន ១០០%</span>
                <span className="text-xl font-bold font-mono text-amber-700">{outstandingBranches.length} សាខា</span>
                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">(បានលទ្ធផលល្អឥតខ្ចោះ)</span>
              </div>
            </div>

            {/* Need Attention card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80 flex items-center gap-3.5">
              <div className="p-2.5 bg-rose-100/50 text-rose-700 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">សាខាអត្រាទាប (&lt;៦០%)</span>
                <span className="text-xl font-bold font-mono text-rose-600">{attentionBranches.length} សាខា</span>
                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">(គួរយកចិត្តទុកដាក់)</span>
              </div>
            </div>

          </div>

          {/* Quick Action Buttons Pane */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
            
            {/* Download CSV Trigger */}
            <button
              onClick={handleDownloadCSV}
              className="p-4 border-2 border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-2xl flex items-center gap-4 transition text-left cursor-pointer group print:hidden"
            >
              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-slate-800 text-sm">ទាញយកជា Excel/CSV (Download CSV)</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ទាញយកតារាងលម្អិតទាំង ២៨ សាខា តាមថ្ងៃនីមួយៗជំនួសឲ្យការមើលក្នុងកម្មវិធី។
                </p>
              </div>
            </button>

            {/* Print PDF Trigger */}
            <button
              onClick={handlePrintPDF}
              className="p-4 border-2 border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl flex items-center gap-4 transition text-left cursor-pointer group print:hidden"
            >
              <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md group-hover:scale-105 transition-transform">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-slate-800 text-sm">បោះពុម្ពជា PDF (Print PDF)</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ទាញយករបាយការណ៍នេះជាទម្រង់ឯកសារ PDF សម្រាប់បោះពុម្ពទុកជាឯកសារយោង។
                </p>
              </div>
            </button>

          </div>

          {/* Preview of outstanding and needing-attention branches */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider">ពិនិត្យមើលបញ្ជីសង្ខេបលទ្ធផល (Preview Lists) ៖</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Outstanding list */}
              <div className="border border-slate-100 rounded-xl p-3.5 space-y-2 bg-slate-50/30">
                <h6 className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  លទ្ធផលល្អឥតខ្ចោះ ១០០% ({outstandingBranches.length})
                </h6>
                {outstandingBranches.length === 0 ? (
                  <p className="text-[11px] text-slate-400">មិនទាន់មានសាខាដែលបាន Post បានគ្រប់ ១០០% ទេ។</p>
                ) : (
                  <ul className="text-xs text-slate-600 space-y-1.5 max-h-[160px] overflow-y-auto">
                    {outstandingBranches.map((o, idx) => (
                      <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{o.branchName}</span>
                        <span className="font-semibold text-slate-500 font-mono text-[11px]">{o.staff}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Needs attention list */}
              <div className="border border-slate-100 rounded-xl p-3.5 space-y-2 bg-slate-50/30">
                <h6 className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  គួរយកចិត្តទុកដាក់ និងជម្រុញការ Post ({attentionBranches.length})
                </h6>
                {attentionBranches.length === 0 ? (
                  <p className="text-[11px] text-slate-400">មិនមានសាខាណាដែលមានអត្រាទាបជាងលក្ខខណ្ឌ ៦០% ទេ។</p>
                ) : (
                  <ul className="text-xs text-slate-600 space-y-1.5 max-h-[160px] overflow-y-auto">
                    {attentionBranches.map((a, idx) => (
                      <li key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{a.branchName} <span className="text-rose-500 font-bold">({a.rate}%)</span></span>
                        <span className="font-semibold text-slate-500 font-mono text-[11px]">{a.staff}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 border text-white rounded-xl text-xs font-bold transition cursor-pointer print:hidden"
          >
            រួចរាល់ (Done)
          </button>
        </div>

      </div>

      {/* Dedicated Printable Report View (Only visible during window.print()) */}
      {createPortal(
        <div id="printable-monthly-report" className="hidden print:block bg-white text-slate-900 w-full">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 5mm;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body > *:not(#printable-monthly-report) {
                display: none !important;
              }
              #printable-monthly-report {
                display: block !important;
                width: 100% !important;
                background: #ffffff !important;
                font-size: 7.5px !important;
                line-height: 1.2 !important;
                zoom: 65%;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              #printable-monthly-report table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #printable-monthly-report tr,
              #printable-monthly-report td,
              #printable-monthly-report th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #printable-monthly-report .print-day-col {
                padding: 1.5px 0.5px !important;
                font-size: 7px !important;
                line-height: 1.1 !important;
              }
              #printable-monthly-report .print-footer-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}</style>

          {/* Top Official GDT Header */}
          <div className="grid grid-cols-3 items-start mb-1">
            <div className="text-left text-[9.5px] leading-snug">
              <div className="font-bold text-slate-900">អគ្គនាយកដ្ឋានពន្ធដារ</div>
              <div className="font-bold underline text-slate-900">នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន</div>
              <div className="text-slate-700">ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន</div>
            </div>
            <div className="flex justify-center">
              <img src={gdtLogoUrl} alt="GDT Logo" className="h-12 w-auto object-contain" />
            </div>
            <div className="text-center text-[9.5px] leading-snug">
              <div className="font-bold text-[10px] text-slate-900">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-bold text-slate-900">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-slate-700 font-bold text-[9px]">────────── ❖ ──────────</div>
            </div>
          </div>

          {/* Report Title & Subtitle */}
          <div className="text-center my-1.5">
            <h1 className="text-[11px] font-bold text-slate-900 leading-tight">
              របាយការណ៍សង្ខេបស្តីពី ការត្រួតពិនិត្យឧបករណ៍ប្រចាំថ្ងៃ
            </h1>
            <p className="text-[9.5px] font-bold text-slate-800 mt-0.5 leading-tight">
              ប្រចាំខែ {khmerMonthNameForPrint} ឆ្នាំ {year}
            </p>
          </div>

          <div className="text-[8.5px] font-bold text-slate-900 mb-1 leading-tight">
            Telegram Group: ITS-SITE-SUPPORT-TEAM
          </div>

          {/* Full Monthly Summary Table */}
          <table className="w-full border-collapse border border-slate-300 text-[7.5px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-center font-bold min-w-[82px] text-[8px]">
                  សាខាពន្ធដារ
                </th>
                <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-center font-bold min-w-[66px] text-[8px]">
                  មន្ត្រីបច្ចេកទេស
                </th>
                {dates.map((dateStr, idx) => {
                  const [y, m, dNum] = dateStr.split('-').map(Number);
                  const dayOfWeek = new Date(y, m - 1, dNum).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <th
                      key={dateStr}
                      className={`print-day-col border border-slate-300 px-0.5 py-0.5 text-center font-bold ${
                        isWeekend ? 'bg-slate-200 text-slate-600' : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </th>
                  );
                })}
                <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-center font-bold min-w-[68px] text-[8px]">
                  អត្រា Post
                </th>
              </tr>
              <tr>
                {dates.map((dateStr) => {
                  const [y, m, dNum] = dateStr.split('-').map(Number);
                  const dayOfWeek = new Date(y, m - 1, dNum).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isSaturday = dayOfWeek === 6;
                  return (
                    <th
                      key={`${dateStr}-sub`}
                      className={`print-day-col border border-slate-300 px-0.5 py-0.5 text-center text-[6.5px] font-bold ${
                        isWeekend ? 'bg-slate-200 text-slate-600' : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      {isWeekend ? (isSaturday ? 'ស' : 'អ') : ''}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedBranchesForPrint.map((b) => {
                const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
                let postedCount = 0;

                const dayCells = dates.map((dateStr) => {
                  const [y, m, dNum] = dateStr.split('-').map(Number);
                  const dayOfWeek = new Date(y, m - 1, dNum).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const r = reportLookup[`${dateStr}_${b.id}`];
                  const isPosted = r && r.status === 'POSTED';
                  const remarkText = (r?.remark || r?.note || '')
                    .replace(/^\[REMARK:(.*?)\]\s*/s, '$1')
                    .trim();
                  const hasRemark = remarkText !== '' && remarkText !== 'ធម្មតា';

                  if (dateStr <= todayStr && !isWeekend && isPosted) {
                    postedCount++;
                  }

                  let content = '';
                  let cellStyle = 'bg-white text-slate-700';

                  if (hasRemark) {
                    content = remarkText;
                    cellStyle = 'bg-rose-100 text-red-600 font-bold text-[6px]';
                  } else if (dateStr <= todayStr) {
                    if (isWeekend) {
                      if (isPosted) {
                        content = '✔';
                        cellStyle = 'bg-emerald-100 text-emerald-800 font-bold';
                      } else {
                        content = 'ស-អ';
                        cellStyle = 'bg-slate-50 text-slate-400 text-[6px]';
                      }
                    } else if (isPosted) {
                      content = '✔';
                      cellStyle = 'bg-emerald-100 text-emerald-800 font-bold';
                    } else if (r && r.status === 'NOT_POSTED') {
                      content = '✘';
                      cellStyle = 'bg-rose-100 text-rose-800 font-bold';
                    }
                  } else {
                    content = '-';
                    cellStyle = 'text-slate-300';
                  }

                  return (
                    <td key={dateStr} className={`print-day-col border border-slate-300 text-center whitespace-nowrap ${cellStyle}`}>
                      {content}
                    </td>
                  );
                });

                const rate = totalWorkingDays > 0 ? Math.round((postedCount / totalWorkingDays) * 100) : 0;
                const rateStyle =
                  rate >= 90
                    ? 'bg-emerald-100 text-emerald-800'
                    : rate >= 60
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800';

                return (
                  <tr key={b.id}>
                    <td className="border border-slate-300 px-1 py-0.5 font-bold text-slate-900 whitespace-nowrap text-[7.5px]">
                      {b.nameKh}
                    </td>
                    <td className="border border-slate-300 px-1 py-0.5 text-slate-700 whitespace-nowrap text-[7.5px]">
                      {bStaff}
                    </td>
                    {dayCells}
                    <td className={`border border-slate-300 px-1 py-0.5 text-center font-bold whitespace-nowrap leading-none ${rateStyle}`}>
                      <span className="text-[7.5px]">{rate}%</span>{' '}
                      <span className="text-[6.5px] font-semibold">({postedCount}/{totalWorkingDays}ថ្ងៃ)</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signature Block */}
          <div className="print-footer-block mt-3 flex justify-end">
            <div className="text-center text-[8.5px] min-w-[180px] leading-snug">
              <div className="italic text-slate-600">
                ធ្វើនៅភ្នំពេញ, ថ្ងៃទី {printDayKh} ខែ {printMonthKh} ឆ្នាំ {printYearKh}
              </div>
              <div className="font-bold text-slate-800 mt-0.5">អ្នករៀបចំរបាយការណ៍</div>
              <div className="mt-6 text-slate-400">......................................................</div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
