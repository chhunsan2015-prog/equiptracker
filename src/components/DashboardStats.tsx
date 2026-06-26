/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Branch, DailyReport, StaffAssignment, Equipment } from '../types.ts';
import { EQUIPMENT_LIST } from '../constants.ts';
import { CheckCircle, XCircle, Users, Percent, HelpCircle, Activity, ChevronRight, Share2, ClipboardList, Clock } from 'lucide-react';

interface DashboardStatsProps {
  branches: Branch[];
  reports: DailyReport[];
  staff: StaffAssignment[];
  selectedDate: string; // "YYYY-MM-DD"
  selectedMonth: string; // "YYYY-MM"
  onBranchSelect?: (branchId: string) => void;
}

export default function DashboardStats({
  branches,
  reports,
  staff,
  selectedDate,
  selectedMonth,
  onBranchSelect,
}: DashboardStatsProps) {
  // Get report map for selected date
  const reportsOnSelectedDate = useMemo(() => {
    const map: Record<string, DailyReport> = {};
    reports.forEach(r => {
      if (r.date === selectedDate) {
        map[r.branchId] = r;
      }
    });
    return map;
  }, [reports, selectedDate]);

  // List of posted branches vs not posted branches for selectedDate
  const { postedList, missedList } = useMemo(() => {
    const posted: Array<{ branch: Branch; report?: DailyReport; staffNames: string }> = [];
    const missed: Array<{ branch: Branch; report?: DailyReport; staffNames: string }> = [];

    branches.forEach(b => {
      const report = reportsOnSelectedDate[b.id];
      const sNames = staff.find(s => s.branchId === b.id)?.staffNames || b.defaultStaff;

      if (report && report.status === 'POSTED') {
        posted.push({ branch: b, report, staffNames: sNames });
      } else {
        missed.push({ branch: b, report, staffNames: sNames });
      }
    });

    // Sort by type (Province first, then Khan) then by Name
    const sortByBranch = (a: any, b: any) => {
      if (a.branch.type !== b.branch.type) {
        return a.branch.type === 'province' ? -1 : 1;
      }
      return a.branch.nameKh.localeCompare(b.branch.nameKh);
    };

    posted.sort(sortByBranch);
    missed.sort(sortByBranch);

    return { postedList: posted, missedList: missed };
  }, [branches, reportsOnSelectedDate, staff]);

  // Monthly aggregated statistics
  const monthlyStats = useMemo(() => {
    // Filter reports for the selected month that are NOT on weekends (Saturdays and Sundays)
    const monthReports = reports.filter(r => {
      if (!r.date.startsWith(selectedMonth)) return false;
      const [y, m, dNum] = r.date.split('-').map(Number);
      const dObj = new Date(y, m - 1, dNum);
      const dayOfWeek = dObj.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

    const totalReports = monthReports.length;
    const postedCount = monthReports.filter(r => r.status === 'POSTED').length;

    // Report frequency per branch
    const branchCompletion: Record<string, { posted: number; total: number; pct: number }> = {};
    
    // We determine how many days in month up to today (if today is in the selected month) or full month days
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const totalDaysInMonth = new Date(yr, mo, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    
    let maxDayToCount = totalDaysInMonth;
    if (selectedMonth === todayStr.substring(0, 7)) {
      maxDayToCount = parseInt(todayStr.split('-')[2]); // count up to today's date
    }

    // Count only weekdays in the period
    let weekdayCount = 0;
    for (let d = 1; d <= maxDayToCount; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${selectedMonth}-${dayStr}`;
      const [y, m, dNum] = dateStr.split('-').map(Number);
      const dObj = new Date(y, m - 1, dNum);
      const dayOfWeek = dObj.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdayCount++;
      }
    }

    branches.forEach(b => {
      const bReports = monthReports.filter(r => r.branchId === b.id);
      const posted = bReports.filter(r => r.status === 'POSTED').length;
      const pct = weekdayCount > 0 ? Math.round((posted / weekdayCount) * 100) : 0;
      branchCompletion[b.id] = { posted, total: weekdayCount, pct };
    });

    // Top performers (pct >= 80)
    const topPerformers = branches
      .map(b => ({ branch: b, ...branchCompletion[b.id] }))
      .filter(item => item.pct >= 80)
      .sort((a, b) => b.pct - a.pct || a.branch.nameKh.localeCompare(b.branch.nameKh));

    // Poorest performers (needs attention, pct < 60)
    const lowPerformers = branches
      .map(b => ({ branch: b, ...branchCompletion[b.id] }))
      .filter(item => item.pct < 60)
      .sort((a, b) => a.pct - b.pct || a.branch.nameKh.localeCompare(b.branch.nameKh));

    return {
      totalReports,
      overallPosted: postedCount,
      overallPct: totalReports > 0 ? Math.round((postedCount / totalReports) * 100) : 0,
      completionRate: branches.length > 0 && weekdayCount > 0 
        ? Math.round((postedCount / (branches.length * weekdayCount)) * 100) 
        : 0,
      topPerformers,
      lowPerformers,
    };
  }, [reports, selectedMonth, branches]);

  // Format date helper (Cambodian date style)
  const formatKhDate = (dateStr: string) => {
    try {
      const [y, m, dNum] = dateStr.split('-').map(Number);
      const d = new Date(y, m - 1, dNum);
      const days = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
      const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
      
      const dayName = days[d.getDay()];
      const dayNum = d.getDate();
      const monthName = months[d.getMonth()];
      const yearKh = d.getFullYear();
      
      return `ថ្ងៃ${dayName} ទី${dayNum} ខែ${monthName} ឆ្នាំ${yearKh}`;
    } catch {
      return dateStr;
    }
  };

  // Helper to generate copy-paste text for leaders
  const handleCopySummary = () => {
    const formattedDate = formatKhDate(selectedDate);
    const textLines = [
      `📊 សេចក្តីរាយការណ៍ការត្រួតពិនិត្យឧបករណ៍បច្ចេកវិទ្យាប្រចាំការដ្ឋាន`,
      `📅 សម្រាប់៖ ${formattedDate}`,
      `⚙️ ឧបករណ៍ត្រួតពិនិត្យ៖ Server Room, Video Conference, QMS, Printer (458e/450i), FaceScan, CCTV`,
      `========================`,
      `✅ បានរាយការណ៍ប្រចាំថ្ងៃ (${postedList.length} សាខា)៖`,
    ];

    postedList.forEach((p, idx) => {
      const eqCount = p.report?.equipmentChecked?.length || 0;
      const eqList = p.report?.equipmentChecked?.map(id => EQUIPMENT_LIST.find(eq => eq.id === id)?.nameEn || id).join(', ') || 'គ្មាន';
      const timeStr = p.report?.telegramPostTime ? ` ម៉ោង ${p.report.telegramPostTime}` : '';
      textLines.push(`${idx + 1}. សាខា${p.branch.nameKh} [${p.staffNames}] - បាន Post Telegram${timeStr} (ពិនិត្យបាន៖ ${eqCount} ឧបករណ៍)`);
    });

    textLines.push(`\n❌ ខកខានរាយការណ៍៖ (${missedList.length} សាខា)៖`);
    missedList.forEach((m, idx) => {
      textLines.push(`${idx + 1}. សាខា${m.branch.nameKh} [${m.staffNames}] - មិនទាន់ផ្សាយ`);
    });

    textLines.push(`\n📈 សរុប៖ បាន Post ${postedList.length}/${branches.length} សាខា (ស្មើនឹង ${Math.round((postedList.length / branches.length) * 100)}%)`);
    textLines.push(`🔗 របាយការណ៍លម្អិត៖ ពិនិត្យលើប្រព័ន្ធតាមដានសាខាពន្ធដារ`);

    navigator.clipboard.writeText(textLines.join('\n'));
    alert('📋 បានលម្អងម្លងចម្លង (Copy) អត្ថបទរបាយការណ៍សម្រាប់ Telegram រួចរាល់ហើយ!');
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Today Sync Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">អត្រារាយការណ៍ថ្ងៃនេះ</p>
            <h4 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {branches.length ? Math.round((postedList.length / branches.length) * 100) : 0}%
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              បាន Post <span className="font-semibold text-emerald-600">{postedList.length}</span> / {branches.length} សាខា
            </p>
          </div>
        </div>

        {/* Card 2: Year/Month Completion */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">អត្រាពេញមួយខែ</p>
            <h4 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {monthlyStats.completionRate}%
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              មធ្យមភាគការផ្សាយដកស្រង់ប្រចាំខែ
            </p>
          </div>
        </div>

        {/* Card 3: Total Provinces Posted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">សាខាខេត្តបាន Post ថ្ងៃនេះ</p>
            <h4 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {postedList.filter(p => p.branch.type === 'province').length} <span className="text-sm font-normal text-slate-400">/24</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              ខកខាន <span className="text-rose-600 font-semibold">{24 - postedList.filter(p => p.branch.type === 'province').length} S.X</span>
            </p>
          </div>
        </div>

        {/* Card 4: Total Khans Posted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">សាខាខណ្ឌបាន Post ថ្ងៃនេះ</p>
            <h4 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {postedList.filter(p => p.branch.type === 'khan').length} <span className="text-sm font-normal text-slate-400">/4</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              ខកខាន <span className="text-rose-600 font-semibold">{4 - postedList.filter(p => p.branch.type === 'khan').length} S.X</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main stats layout for Daily: Who posted vs who did not post */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Posted Successfully */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-emerald-100 bg-emerald-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-800 text-base">
                បានរាយការណ៍ក្នុង Telegram ({postedList.length} សាខា)
              </h3>
            </div>
            
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Copy របាយការណ៍ Telegram
            </button>
          </div>

          <div className="p-2 flex-1 overflow-y-auto divide-y divide-slate-100">
            {postedList.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="font-medium text-sm">មិនទាន់មានសាខារាយការណ៍នៅឡើយទេសម្រាប់ថ្ងៃនេះ។</p>
              </div>
            ) : (
              postedList.map(({ branch, report, staffNames }) => {
                const eqCount = report?.equipmentChecked?.length || 0;
                return (
                  <div
                    key={branch.id}
                    onClick={() => onBranchSelect?.(branch.id)}
                    className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 w-2/3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{branch.nameKh}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          {branch.type === 'province' ? 'ខេត្ត' : 'ខណ្ឌ'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Technical Staff: <span className="text-slate-700 font-semibold">{staffNames}</span>
                      </div>
                      {report?.note && (
                        <div className="text-xs text-slate-400 italic font-normal line-clamp-1">
                          « {report.note} »
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {report?.telegramPostTime ? `ម៉ោង ${report.telegramPostTime}` : 'បាន Post'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        បានពិនិត្យ៖ <strong className="text-slate-600 font-mono">{eqCount}/7</strong> ឧបករណ៍
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Missed/Not Posted */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-rose-100 bg-rose-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <h3 className="font-semibold text-slate-800 text-base">
                ខកខាន ឬមិនទាន់បានរាយការណ៍ ({missedList.length} សាខា)
              </h3>
            </div>
          </div>

          <div className="p-2 flex-1 overflow-y-auto divide-y divide-slate-100">
            {missedList.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <CheckCircle className="w-10 h-10 mx-auto text-emerald-500/50 stroke-[1.5] mb-2" />
                <p className="font-medium text-sm text-emerald-600">សាខាទាំងអស់ ១០០% បានរាយការណ៍រួចរាល់!</p>
              </div>
            ) : (
              missedList.map(({ branch, staffNames }) => (
                <div
                  key={branch.id}
                  onClick={() => onBranchSelect?.(branch.id)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{branch.nameKh}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                        {branch.type === 'province' ? 'ខេត្ត' : 'ខណ្ឌ'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Technical Staff: <span className="text-slate-700 font-semibold">{staffNames}</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1 animate-pulse">
                    <XCircle className="w-3 h-3 text-rose-500" />
                    Pending
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monthly Performance: Best and Poorest Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-base mb-4 flex items-center gap-2">
            🏆 ក្រុមការងារគំរូប្រចាំខែ (រាយការណ៍ទៀងទាត់បំផុត {'>'}= 80%)
          </h3>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
            {monthlyStats.topPerformers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">មិនទាន់មានសាខាណាសម្រេចបានចំនួនផ្សាយឡើយ។</p>
            ) : (
              monthlyStats.topPerformers.map((item, idx) => (
                <div key={item.branch.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-amber-50 text-amber-600 font-bold rounded-full flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{item.branch.nameKh}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono">({item.posted}/{item.total} ថ្ងៃ)</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {item.pct}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Poorest Performers Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-base mb-4 flex items-center gap-2 text-rose-700">
            ⚠ ក្រុមការងារត្រូវលើកទឹកចិត្ត/ពន្លឿន (ខកខានញឹកញាប់ {'<'}= 60%)
          </h3>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
            {monthlyStats.lowPerformers.length === 0 ? (
              <p className="text-xs text-emerald-600 py-4 text-center font-medium">អស្ចារ្យណាស់! គ្មានសាខាណាដែលមានការខកខានច្រើនជាង ៦០% ទេ។</p>
            ) : (
              monthlyStats.lowPerformers.map((item, idx) => (
                <div key={item.branch.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-rose-50 text-rose-600 font-bold rounded-full flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{item.branch.nameKh}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono">({item.posted}/{item.total} ថ្ងៃ)</span>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      {item.pct}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
