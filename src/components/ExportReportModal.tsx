/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Branch, DailyReport, StaffAssignment } from '../types.ts';
import { FileSpreadsheet, Copy, X, Check, Award, AlertCircle, FileText, Download } from 'lucide-react';

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

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper code to map reports
  const reportLookup: Record<string, DailyReport> = {};
  reports.forEach(r => {
    reportLookup[`${r.date}_${r.branchId}`] = r;
  });

  // Calculate statistics for the report preview
  let totalValidDays = 0;
  let totalPostedCount = 0;

  const branchReportsSummary = branches.map(b => {
    const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
    let posted = 0;
    let validDays = 0;

    dates.forEach(dateStr => {
      if (dateStr <= todayStr) {
        validDays++;
        const r = reportLookup[`${dateStr}_${b.id}`];
        if (r && r.status === 'POSTED') {
          posted++;
        }
      }
    });

    const rate = validDays > 0 ? Math.round((posted / validDays) * 100) : 0;
    
    totalValidDays += validDays;
    totalPostedCount += posted;

    return {
      branchName: b.nameKh,
      branchEn: b.nameEn,
      staff: bStaff,
      posted,
      total: validDays,
      rate,
    };
  });

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
      // CSV headers
      const csvHeaders = [
        'សាខាខេត្ត/ខណ្ឌ (Branch Name)',
        'មន្ត្រីបង្គោល (Technical Staff)',
        ...Array.from({ length: daysInMonth }, (_, i) => `ថ្ងៃទី ${i + 1}`),
        'ចំនួនបាន Post',
        'ចំនួនថ្ងៃទាមទារ',
        'អត្រាសម្រេច (%)'
      ];

      // Convert rows
      const rows = branches.map(b => {
        const bStaff = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
        let posted = 0;
        let validDays = 0;

        const dayStatuses = dates.map(dateStr => {
          if (dateStr <= todayStr) {
            validDays++;
            const r = reportLookup[`${dateStr}_${b.id}`];
            if (r) {
              if (r.status === 'POSTED') {
                posted++;
                return '☑';
              } else {
                return 'NOT POSTED';
              }
            }
            return '';
          }
          return '-';
        });

        const rate = validDays > 0 ? Math.round((posted / validDays) * 100) : 0;

        return [
          b.nameKh,
          bStaff,
          ...dayStatuses,
          posted,
          validDays,
          `${rate}%`
        ];
      });

      // Join CSV elements
      const csvMatrix = [csvHeaders, ...rows];
      const csvString = csvMatrix
        .map(row => row.map(value => {
          // Escape quotes and commas if any
          let str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(','))
        .join('\n');

      // Khmer Unicode Safe download stream creation
      const utf8Bom = '\uFEFF';
      const blob = new Blob([utf8Bom + csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Daily_Equipment_Report_Summary_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('កំហុសពេលទាញយក CSV៖ ' + String(e));
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
