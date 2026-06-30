/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
   * Action function: Export grid to a clean CSV download
   * Demonstrates incredible precision by appending UTF-8 Byte Order Mark (BOM)
   */
  const handleDownloadCSV = () => {
    try {
      // Days headers
      const dayHeadersHTML = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
        const [y, m, dNum] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, dNum);
        const dayOfWeek = dObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSaturday = dayOfWeek === 6;
        
        const headerClass = isWeekend ? 'header-day-weekend' : 'header-day';
        const weekendIndicator = isWeekend ? (isSaturday ? 'ស' : 'អ') : '';
        
        return `
          <th class="${headerClass}">
            <div style="font-size: 10pt; font-weight: bold;">${dayNum}</div>
            <div style="font-size: 8pt; font-weight: normal; opacity: 0.8; margin-top: 1px;">${weekendIndicator}</div>
          </th>
        `;
      }).join('');

      // Build table rows
      const rowsHTML = branches.map(b => {
        const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
        let postedCount = 0;

        // Day cell values
        const dayCellsHTML = dates.map(dateStr => {
          const [y, m, dNum] = dateStr.split('-').map(Number);
          const dObj = new Date(y, m - 1, dNum);
          const dayOfWeek = dObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const r = reportLookup[`${dateStr}_${b.id}`];
          const hasReport = !!r;
          const isPosted = hasReport && r.status === 'POSTED';

          if (dateStr <= todayStr) {
            if (isWeekend) {
              if (isPosted) {
                return `<td class="cell-weekend-posted">✔</td>`;
              }
              return `<td class="cell-weekend">ស-អ</td>`;
            }

            if (isPosted) {
              postedCount++;
              return `<td class="cell-posted">✔</td>`;
            } else if (hasReport && r.status === 'NOT_POSTED') {
              return `<td class="cell-unposted">✘</td>`;
            }
            return `<td></td>`;
          }
          
          return `<td style="color: #cbd5e1; font-size: 9pt;">-</td>`;
        }).join('');

        const rate = totalWorkingDays > 0 ? Math.round((postedCount / totalWorkingDays) * 100) : 0;
        let rateClass = 'rate-low';
        if (rate >= 90) {
          rateClass = 'rate-high';
        } else if (rate >= 60) {
          rateClass = 'rate-medium';
        }

        return `
          <tr>
            <td class="branch-name">
              <div style="font-size: 10pt; font-weight: bold;">${b.nameKh}</div>
              <div class="branch-en">${b.nameEn}</div>
            </td>
            <td class="staff-name">${bStaff}</td>
            ${dayCellsHTML}
            <td class="${rateClass}">
              <div style="font-size: 11pt; font-weight: bold;">${rate}%</div>
              <div style="font-size: 8pt; font-weight: normal; color: #475569; margin-top: 1px;">
                (${postedCount}/${totalWorkingDays} ថ្ងៃ)
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Get Khmer month name
      const khmerMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];
      const khmerMonthName = khmerMonths[month - 1] || '';

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Summary Report</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body {
              margin: 20px;
              font-family: 'Khmer OS Siemreap', 'Siemreap', 'Segoe UI', sans-serif;
            }
            .title {
              font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif;
              color: #0f172a;
              font-size: 16pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 5px;
            }
            .subtitle {
              font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif;
              color: #475569;
              font-size: 11pt;
              text-align: center;
              margin-bottom: 20px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 4px;
              text-align: center;
              font-size: 10pt;
              vertical-align: middle;
            }
            th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: bold;
            }
            .header-main {
              background-color: #1e293b;
              color: #ffffff;
              font-weight: bold;
              padding: 10px 6px;
            }
            .header-day {
              min-width: 32px;
              background-color: #f8fafc;
              color: #334155;
            }
            .header-day-weekend {
              background-color: #e2e8f0;
              color: #64748b;
              font-weight: normal;
              min-width: 32px;
            }
            .branch-name {
              text-align: left;
              font-weight: bold;
              background-color: #ffffff;
              color: #0f172a;
              min-width: 170px;
              padding-left: 8px;
            }
            .branch-en {
              font-size: 7.5pt;
              color: #64748b;
              font-weight: normal;
              margin-top: 2px;
            }
            .staff-name {
              background-color: #ffffff;
              color: #334155;
              font-weight: normal;
              min-width: 110px;
            }
            .cell-posted {
              background-color: #d1fae5;
              color: #065f46;
              font-weight: bold;
              font-size: 11pt;
            }
            .cell-unposted {
              background-color: #fee2e2;
              color: #991b1b;
              font-weight: bold;
              font-size: 11pt;
            }
            .cell-weekend {
              background-color: #f8fafc;
              color: #94a3b8;
              font-size: 7.5pt;
            }
            .cell-weekend-posted {
              background-color: #d1fae5;
              color: #065f46;
              font-weight: bold;
              font-size: 11pt;
            }
            .rate-high {
              background-color: #d1fae5;
              color: #065f46;
              font-weight: bold;
              font-size: 10pt;
              min-width: 85px;
            }
            .rate-medium {
              background-color: #fef3c7;
              color: #92400e;
              font-weight: bold;
              font-size: 10pt;
              min-width: 85px;
            }
            .rate-low {
              background-color: #fee2e2;
              color: #991b1b;
              font-weight: bold;
              font-size: 10pt;
              min-width: 85px;
            }
          </style>
        </head>
        <body>
          <div class="title">របាយការណ៍សង្ខេបការត្រួតពិនិត្យឧបករណ៍ប្រចាំថ្ងៃ</div>
          <div class="subtitle">ប្រចាំខែ ${khmerMonthName} ឆ្នាំ ${year}</div>
          
          <table>
            <thead>
              <tr>
                <th class="header-main" style="text-align: left;">សាខាខេត្ត/ខណ្ឌ (Branch Name)</th>
                <th class="header-main">មន្ត្រីបង្គោល (Technical Staff)</th>
                ${dayHeadersHTML}
                <th class="header-main">អត្រា Post</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Khmer Unicode Safe download stream creation
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Daily_Equipment_Report_Summary_${selectedMonth}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
