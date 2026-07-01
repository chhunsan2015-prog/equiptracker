/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import XLSX from 'xlsx-js-style';
import { Branch, DailyReport, StaffAssignment } from '../types.ts';
import { FileSpreadsheet, Copy, X, Check, Award, AlertCircle, FileText, Download } from 'lucide-react';
import { getWorkingDaysInMonth } from '../constants.ts';

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
   * Action function: Export grid to a clean and styled Excel (.xlsx) file using xlsx-js-style
   */
  const handleDownloadCSV = () => {
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

      // Title & Subtitle Row
      setCell(0, 0, "របាយការណ៍សង្ខេបការត្រួតពិនិត្យឧបករណ៍ប្រចាំថ្ងៃ", {
        font: { sz: 16, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      setCell(0, 1, `ប្រចាំខែ ${khmerMonthName} ឆ្នាំ ${year}`, {
        font: { sz: 11, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Legend Row (Row index 3)
      // Legend 1: "☑ បានរាយការណ៍ក្នុង Telegram (POSTED)" (Col A)
      setCell(0, 3, "☑ បានរាយការណ៍ក្នុង Telegram (POSTED)", {
        font: { sz: 9.5, bold: true, color: { rgb: '10B981' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
      // Legend 2: "☒ អត់បានរាយការណ៍ (NOT POSTED)" (Col J / Index 9)
      setCell(9, 3, "☒ អត់បានរាយការណ៍ (NOT POSTED)", {
        font: { sz: 9.5, bold: true, color: { rgb: 'EF4444' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
      // Legend 3: "☐ មិនទាន់មានទិន្នន័យ (No Data / Out of range)" (Col S / Index 18)
      setCell(18, 3, "☐ មិនទាន់មានទិន្នន័យ (No Data / Out of range)", {
        font: { sz: 9.5, bold: true, color: { rgb: '64748B' } },
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
        fill: { type: 'pattern', patternType: 'solid', fgColor: { rgb: '1E293B' } },
        font: { sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
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

      // Write table headers (Row index 4 and Row index 5)
      setCell(0, 4, "សាខាខេត្ត/ខណ្ឌ (Branch Name)", mainHeaderStyle);
      setCell(0, 5, "", mainHeaderStyle);

      setCell(1, 4, "មន្ត្រីបង្គោល (Technical Staff)", mainHeaderStyle);
      setCell(1, 5, "", mainHeaderStyle);

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

        setCell(colIndex, 4, dayNum, dayStyle);
        setCell(colIndex, 5, weekendIndicator, dayStyle);
      }

      setCell(rateColIndex, 4, "អត្រា Post", mainHeaderStyle);
      setCell(rateColIndex, 5, "", mainHeaderStyle);

      // Initialize merges list
      const merges = [
        { s: { c: 0, r: 0 }, e: { c: rateColIndex, r: 0 } }, // title merge
        { s: { c: 0, r: 1 }, e: { c: rateColIndex, r: 1 } }, // subtitle merge
        { s: { c: 0, r: 3 }, e: { c: 8, r: 3 } }, // legend 1
        { s: { c: 9, r: 3 }, e: { c: 17, r: 3 } }, // legend 2
        { s: { c: 18, r: 3 }, e: { c: 28, r: 3 } }, // legend 3
        { s: { c: 0, r: 4 }, e: { c: 0, r: 5 } }, // branch header
        { s: { c: 1, r: 4 }, e: { c: 1, r: 5 } }, // staff header
        { s: { c: rateColIndex, r: 4 }, e: { c: rateColIndex, r: 5 } }, // rate header
      ];

      // Write table rows (Row index 6 onwards)
      sortedBranchesForExcel.forEach((b, bIdx) => {
        const rowIndex = 6 + bIdx;
        const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
        let postedCount = 0;

        // Column A: Branch Name
        setCell(0, rowIndex, b.nameKh, {
          font: { sz: 9.5, bold: true, color: { rgb: '0F172A' } },
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

          let cellVal = "";
          let fill: any = undefined;
          let font: any = { sz: 9, color: { rgb: '000000' } };

          if (dateStr <= todayStr) {
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
                postedCount++;
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
      const footerRowStart = 6 + sortedBranchesForExcel.length + 2;

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
        { wch: 25 }, // Column A: Branch Name
        { wch: 18 }, // Column B: Staff Name
      ];
      for (let i = 0; i < daysInMonth; i++) {
        colWidths.push({ wch: 4.8 }); // Days columns
      }
      colWidths.push({ wch: 16 }); // Rate Column
      ws['!cols'] = colWidths;

      // Row Heights
      const rowHeights = [
        { hpt: 35 }, // Row 1 (Title)
        { hpt: 22 }, // Row 2 (Subtitle)
        { hpt: 15 }, // Row 3 (Spacer)
        { hpt: 20 }, // Row 4 (Legend)
        { hpt: 22 }, // Row 5 (Header Row 1)
        { hpt: 18 }, // Row 6 (Header Row 2)
      ];
      for (let i = 0; i < sortedBranchesForExcel.length; i++) {
        rowHeights.push({ hpt: 28 }); // Branch rows
      }
      ws['!rows'] = rowHeights;

      // Define worksheet range
      const lastColLetter = XLSX.utils.encode_col(rateColIndex);
      const lastRowNumber = footerRowStart + 6;
      ws['!ref'] = `A1:${lastColLetter}${lastRowNumber}`;

      // Append sheet to workbook and save as XLSX
      XLSX.utils.book_append_sheet(wb, ws, "របាយការណ៍សង្ខេប");
      XLSX.writeFile(wb, `Daily_Equipment_Report_Summary_${selectedMonth}.xlsx`);
    } catch (e) {
      alert('កំហុសពេលទាញយក Excel៖ ' + String(e));
    }
  };

  /**
   * Action function: Generates a beautiful text report summary format to copy for Telegram
   */
  const handleCopyTelegramSummary = () => {
    try {
      const topOfficesText = outstandingBranches.length > 0 
        ? outstandingBranches.map(o => `• ${o.branchName} (${o.staff})`).slice(0, 8).join('\n') + (outstandingBranches.length > 8 ? `\n• និងផ្សេងៗទៀត...` : '')
        : 'គ្មាន';

      const needsAttentionText = attentionBranches.length > 0
        ? attentionBranches.map(a => `• ${a.branchName} (${a.rate}% - ${a.staff})`).slice(0, 8).join('\n') + (attentionBranches.length > 8 ? `\n• និងផ្សេងៗទៀត...` : '')
        : 'គ្មាន';

      const telegramText = `📊 **របាយការណ៍សង្ខេបការត្រួតពិនិត្យឧបករណ៍ប្រចាំខែ ${selectedMonth}**

🗓 ខែត្រួតពិនិត្យ៖ ${selectedMonth}
🏦 ចំនួនសាខាបញ្ជូនទិន្នន័យ៖ ${branches.length} សាខា
✔️ អត្រាការ Post សរុបរួម៖ **${overallRate}%** (${totalPostedCount}/${totalValidDays} ថ្ងៃ)

🏆 **សាខាគំរូដែលបានបោះផ្សាយព័ត៌មានគ្រប់ ១០០% (Outstanding Branches)៖**
${topOfficesText}

⚠️ **សាខាដែលមានអត្រាទាប ឬតម្រូវឲ្យយកចិត្តទុកដាក់ (<60%)៖**
${needsAttentionText}

សេចក្តីរាយការណ៍ចេញពីកម្មវិធី៖ "ប្រព័ន្ធតាមដានឧបករណ៍បច្ចេកវិទ្យាព័ត៌មាន សាខាពន្ធដារ"`;

      navigator.clipboard.writeText(telegramText);
      alert('📋 បានចម្លងសេចក្តីសង្ខេប Telegram ទៅក្នុង Clipboard!');
    } catch (e) {
      alert('កំហុសពេលចម្លង៖ ' + String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">ទាញយករបាយការណ៍សង្ខេបប្រចាំខែ (Monthly Report Export)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ទាញយកទិន្នន័យប្រចាំខែ <strong className="text-emerald-700">{selectedMonth}</strong> ទៅជា Excel/CSV ឬចម្លងសេចក្តីសង្ខេប Telegram។
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Download CSV Trigger */}
            <button
              onClick={handleDownloadCSV}
              className="p-4 border-2 border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-2xl flex items-center gap-4 transition text-left cursor-pointer group"
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

            {/* Telegram Clipboard Copy Trigger */}
            <button
              onClick={handleCopyTelegramSummary}
              className="p-4 border-2 border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl flex items-center gap-4 transition text-left cursor-pointer group"
            >
              <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md group-hover:scale-105 transition-transform">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-slate-800 text-sm">ចម្លងសេចក្តីសង្ខេប Telegram (Copy Text)</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ចម្លងរបាយការណ៍សង្ខេបរៀបចំរួចជាស្រេច សម្រាប់យកទៅផ្ញើចូលក្នុង Telegram Group។
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
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 border text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            រួចរាល់ (Done)
          </button>
        </div>

      </div>
    </div>
  );
}
