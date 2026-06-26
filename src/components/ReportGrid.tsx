/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Branch, DailyReport, StaffAssignment } from '../types.ts';
import { EQUIPMENT_LIST, getWorkingDaysInMonth } from '../constants.ts';
import { Check, X, Edit2, AlertCircle, Calendar, Filter, Users, ClipboardList, FileSpreadsheet } from 'lucide-react';
import ExportReportModal from './ExportReportModal.tsx';

interface ReportGridProps {
  branches: Branch[];
  reports: DailyReport[];
  staff: StaffAssignment[];
  selectedMonth: string; // "YYYY-MM"
  onCellClick: (branchId: string, dateStr: string) => void;
  filterType: 'all' | 'province' | 'khan';
}

export default function ReportGrid({
  branches,
  reports,
  staff,
  selectedMonth,
  onCellClick,
  filterType,
}: ReportGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Local today date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Extract year and month
  const [year, month] = selectedMonth.split('-').map(Number);

  // Number of days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // Generate lists of dates for columns
  const dateStrings = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      list.push(`${selectedMonth}-${dayStr}`);
    }
    return list;
  }, [selectedMonth, daysInMonth]);

  // Map reports to a lookup object for O(1) cell access
  const reportLookup = useMemo(() => {
    const lookup: Record<string, DailyReport> = {};
    reports.forEach(r => {
      lookup[`${r.date}_${r.branchId}`] = r;
    });
    return lookup;
  }, [reports]);

  // Filter branches based on category & search query and sort requested ones to the bottom
  const filteredBranches = useMemo(() => {
    const list = branches.filter(b => {
      // Category filter
      if (filterType === 'province' && b.type !== 'province') return false;
      if (filterType === 'khan' && b.type !== 'khan') return false;

      // Search query
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      const staffInfo = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;
      return (
        b.nameKh.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        staffInfo.toLowerCase().includes(q)
      );
    });

    const bottomBranchIds = ['PROV_PLN', 'PROV_KRT', 'PROV_PST', 'PROV_KEP', 'PROV_OMC'];

    return [...list].sort((a, b) => {
      const aIsBottom = bottomBranchIds.includes(a.id);
      const bIsBottom = bottomBranchIds.includes(b.id);

      if (aIsBottom && !bIsBottom) return 1;
      if (!aIsBottom && bIsBottom) return -1;
      if (aIsBottom && bIsBottom) {
        return bottomBranchIds.indexOf(a.id) - bottomBranchIds.indexOf(b.id);
      }
      return 0;
    });
  }, [branches, filterType, searchQuery, staff]);

  // Calculate stats for each branch in the selected month
  const branchStats = useMemo(() => {
    const stats: Record<string, { posted: number; totalDays: number; pct: number }> = {};
    const totalWorkingDays = getWorkingDaysInMonth(year, month);
    
    filteredBranches.forEach(b => {
      let postedCount = 0;
      
      dateStrings.forEach(dateStr => {
        // Exclude weekends (Saturday = 6, Sunday = 0)
        const [y, m, dNum] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, dNum);
        const dayOfWeek = dObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return; // Skip weekend days for calculation
        }

        // Only count days up to today as valid for tracking ratios
        if (dateStr <= todayStr) {
          const r = reportLookup[`${dateStr}_${b.id}`];
          if (r && r.status === 'POSTED') {
            postedCount++;
          }
        }
      });

      stats[b.id] = {
        posted: postedCount,
        totalDays: totalWorkingDays || 1,
        pct: totalWorkingDays ? Math.round((postedCount / totalWorkingDays) * 100) : 0,
      };
    });

    return stats;
  }, [filteredBranches, dateStrings, reportLookup, todayStr, year, month]);

  return (
    <div id="report-grid-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Grid Controls Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-800 text-lg">
            តារាងរាយការណ៍ប្រចាំខែ ({selectedMonth})
          </h3>
        </div>

        {/* Search & Export Report Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="ស្វែងរកសាខា ឬបុគ្គលិក..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white w-full sm:w-64 md:w-72 shadow-sm"
          />
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs transition duration-200 shadow-sm whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            ទាញយករបាយការណ៍
          </button>
        </div>
      </div>

      {/* Legend Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <Check className="w-3 h-3" />
          </div>
          <span>បានរាយការណ៍ក្នុង Telegram (POSTED)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-200">
            <X className="w-3 h-3" />
          </div>
          <span>អត់បានរាយការណ៍ (NOT POSTED)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
          <span>មិនទាន់មានទិន្នន័យ (No Data / Out of range)</span>
        </div>
        <div className="ml-auto text-xs text-slate-400">
          * បញ្ជាក់៖ ចុចលើប្រអប់ (Cell) នីមួយៗដើម្បីបញ្ចូល ឬកែរាយការណ៍
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-100">
              {/* Sticky Columns */}
              <th className="sticky left-0 bg-slate-50 px-4 py-3 min-w-[200px] z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                សាខាខេត្ត/ខណ្ឌ
              </th>
              <th className="sticky left-[200px] bg-slate-50 px-3 py-3 min-w-[120px] z-10 border-r border-slate-100 text-center shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                បុគ្គលិកប្រចាំការ
              </th>

              {/* Day Headers */}
              {dateStrings.map((dateStr, index) => {
                const dayNum = index + 1;
                // Highlight today if relevant month
                const isToday = todayStr === dateStr;
                const [y, m, dNum] = dateStr.split('-').map(Number);
                const dObj = new Date(y, m - 1, dNum);
                const dayOfWeek = dObj.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isSaturday = dayOfWeek === 6;

                return (
                  <th
                    key={dayNum}
                    className={`px-1 py-2 text-center border-r border-slate-100 min-w-[42px] text-[10px] ${
                      isToday 
                        ? 'bg-amber-50 text-amber-800 font-bold border-b-2 border-b-amber-500' 
                        : isWeekend 
                          ? 'bg-slate-100/70 text-slate-400 font-normal' 
                          : 'text-slate-600 font-semibold'
                    }`}
                    title={isWeekend ? (isSaturday ? 'ថ្ងៃសៅរ៍ (ចុងសប្តាហ៍)' : 'ថ្ងៃអាទិត្យ (ចុងសប្តាហ៍)') : undefined}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span>{dayNum}</span>
                      <span className="text-[8px] font-bold mt-0.5 opacity-80">
                        {isWeekend ? (isSaturday ? 'ស' : 'អ') : ''}
                      </span>
                    </div>
                  </th>
                );
              })}

              <th className="px-4 py-3 text-center min-w-[90px] font-bold text-slate-700">
                អត្រា Post
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredBranches.length === 0 ? (
              <tr>
                <td colSpan={daysInMonth + 3} className="text-center py-10 text-slate-400 font-medium">
                  មិនមានទិន្នន័យសាខាត្រូវបង្ហាញឡើយ។
                </td>
              </tr>
            ) : (
              filteredBranches.map(branch => {
                const bStaff = staff.find(s => s.branchId === branch.id)?.staffNames || branch.defaultStaff;
                const stats = branchStats[branch.id];

                return (
                  <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Branch Name Column (Sticky) */}
                    <td className="sticky left-0 bg-white font-medium text-slate-800 px-4 py-2 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 hover:bg-slate-50">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{branch.nameKh}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{branch.nameEn}</span>
                      </div>
                    </td>

                    {/* Staff Column (Sticky) */}
                    <td className="sticky left-[200px] bg-white text-slate-500 px-3 py-2 border-r border-slate-100 text-center shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px] hover:bg-slate-50">
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {bStaff}
                      </span>
                    </td>

                    {/* Status Cells */}
                    {dateStrings.map((dateStr) => {
                      const report = reportLookup[`${dateStr}_${branch.id}`];
                      const [y, m, dNum] = dateStr.split('-').map(Number);
                      const dObj = new Date(y, m - 1, dNum);
                      const dayOfWeek = dObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      let cellClass = isWeekend 
                        ? 'bg-slate-50 hover:bg-emerald-50/40 cursor-pointer text-slate-300/40'
                        : 'bg-white hover:bg-emerald-50/40 cursor-pointer text-slate-300';
                      let icon = null;

                      if (report) {
                        if (report.status === 'POSTED') {
                          cellClass = 'bg-emerald-50 hover:bg-emerald-100/70 text-emerald-600 border border-emerald-100 cursor-pointer';
                          icon = <Check className="w-3.5 h-3.5 mx-auto stroke-[2.5]" />;
                        } else {
                          cellClass = 'bg-rose-50 hover:bg-rose-100/70 text-rose-600 border border-rose-100 cursor-pointer';
                          icon = <X className="w-3.5 h-3.5 mx-auto stroke-[2.5]" />;
                        }
                      }

                      const cellId = `cell-${branch.id}-${dateStr}`;

                      return (
                        <td
                          key={dateStr}
                          id={cellId}
                          onClick={() => onCellClick(branch.id, dateStr)}
                          className={`text-center p-1.5 transition-all outline-none border-r border-slate-50 font-medium select-none ${cellClass}`}
                          title={`${branch.nameKh} - ${dateStr}${isWeekend ? ' (ចុងសប្តាហ៍ - មិនរាប់បញ្ចូល)' : ''} ${report ? `(${report.status === 'POSTED' ? 'បាន Post' : 'អត់បាន Post'}: ${report.reporterName || 'គ្មានឈ្មោះ'})` : '(ចុចដើម្បីបន្ថែមរាយការណ៍)'}`}
                        >
                          <div className="min-h-[22px] flex items-center justify-center">
                            {icon}
                          </div>
                        </td>
                      );
                    })}

                    {/* Completion Ratio */}
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      <div className="flex items-center justify-center flex-col gap-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          stats?.pct >= 90 ? 'bg-emerald-100 text-emerald-800' :
                          stats?.pct >= 60 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {stats?.pct}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({stats?.posted}/{stats?.totalDays} ថ្ងៃ)
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedMonth={selectedMonth}
        branches={branches}
        reports={reports}
        staff={staff}
      />
    </div>
  );
}
