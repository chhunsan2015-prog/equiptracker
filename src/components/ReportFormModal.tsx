/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Branch, DailyReport, StaffAssignment } from '../types.ts';
import { EQUIPMENT_LIST } from '../constants.ts';
import { X, Check, ClipboardList, Info, HelpCircle, CheckSquare, Square, Clock } from 'lucide-react';
import { formatError } from '../utils/supabaseClient.ts';

interface ReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: DailyReport) => Promise<void>;
  selectedBranchId: string;
  selectedDate: string;
  branches: Branch[];
  staff: StaffAssignment[];
  reports: DailyReport[]; // To load existing report if any
}

export default function ReportFormModal({
  isOpen,
  onClose,
  onSubmit,
  selectedBranchId,
  selectedDate,
  branches,
  staff,
  reports,
}: ReportFormModalProps) {
  const [status, setStatus] = useState<'POSTED' | 'NOT_POSTED'>('POSTED');
  const [checkedEquipment, setCheckedEquipment] = useState<string[]>(EQUIPMENT_LIST.map(e => e.id));
  const [reporterName, setReporterName] = useState('');
  const [postTime, setPostTime] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeBranch = branches.find(b => b.id === selectedBranchId);

  // Initialize form with existing report or defaults
  useEffect(() => {
    if (!isOpen) return;

    // Try finding existing report for selectedDate and branchId
    const existing = reports.find(r => r.date === selectedDate && r.branchId === selectedBranchId);
    
    // Grab assigned staff name
    const assignedStaff = staff.find(s => s.branchId === selectedBranchId)?.staffNames || 
                          activeBranch?.defaultStaff || '';

    if (existing) {
      setStatus(existing.status);
      setCheckedEquipment(existing.equipmentChecked);
      setReporterName(existing.reporterName || assignedStaff);
      setPostTime(existing.telegramPostTime);
      setNote(existing.note);
    } else {
      // Set default values
      setStatus('POSTED');
      // All 7 checked by default for swift data entry
      setCheckedEquipment(EQUIPMENT_LIST.map(e => e.id));
      setReporterName(assignedStaff);
      
      // Default time of report to current hours/minutes (e.g. "09:30")
      const now = new Date();
      const currentHr = String(now.getHours()).padStart(2, '0');
      const currentMn = String(now.getMinutes()).padStart(2, '0');
      setPostTime(`${currentHr}:${currentMn}`);
      setNote('');
    }
  }, [isOpen, selectedBranchId, selectedDate, reports, staff, activeBranch]);

  if (!isOpen || !activeBranch) return null;

  const toggleEquipment = (id: string) => {
    setCheckedEquipment(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSelectAllEquipment = () => {
    setCheckedEquipment(EQUIPMENT_LIST.map(e => e.id));
  };

  const handleSelectNoneEquipment = () => {
    setCheckedEquipment([]);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: DailyReport = {
      date: selectedDate,
      branchId: selectedBranchId,
      status,
      equipmentChecked: status === 'POSTED' ? checkedEquipment : [],
      reporterName: reporterName.trim(),
      telegramPostTime: status === 'POSTED' ? postTime : '',
      note: note.trim(),
      loggedAt: new Date().toISOString(),
    };

    console.log("🔥 ចាប់ផ្តើមដំណើរការ Save:", payload);

    if (!reporterName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះបុគ្គលិករាយការណ៍ (Reporter Name)');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error("កំហុសលម្អិត:", err);
      const errMsg = formatError(err);
      alert('កំហុសពេលបញ្ចូលទិន្នន័យ៖ ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">កំណត់ការរាយការណ៍ (Daily Post Review)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                សាខាពន្ធដារ៖ <strong className="text-emerald-700">{activeBranch.nameKh}</strong> | កាលបរិច្ឆេទ៖ <strong>{selectedDate}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Form Content */}
        <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="p-6 space-y-4">
            
            {/* Post Status Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">ស្ថានភាពរាយការណ៍ក្នុង Telegram (Post Status)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('POSTED')}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    status === 'POSTED'
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700'
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  }`}
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  បាន Post ក្នុង Telegram (POSTED)
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('NOT_POSTED')}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    status === 'NOT_POSTED'
                      ? 'border-rose-500 bg-rose-50/40 text-rose-700'
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4 text-rose-600" />
                  អត់បាន Post ទេ (NOT POSTED)
                </button>
              </div>
            </div>

            {/* Reporter Person Names */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">ឈ្មោះអ្នកត្រួតពិនិត្យ/រាយការណ៍ (Technical Staff)</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
                placeholder="ឧ. សុខ ជា, ម៉ៅ តុលា"
                required
              />
            </div>

            {status === 'POSTED' && (
              <>
                {/* Telegram Post Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ម៉ោងផ្សព្វផ្សាយ Telegram (Telegram Post Time)
                  </label>
                  <input
                    type="text"
                    value={postTime}
                    onChange={(e) => setPostTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="ឧ. 09:30"
                  />
                </div>

                {/* Equipment Inspected Checkbox Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      ឧបករណ៍ដែលបានដំណើរការ/ពិនិត្យ (Equipment Checked)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllEquipment}
                        className="text-[10px] text-emerald-600 hover:underline font-bold"
                      >
                        លម្អល្អ (Select All)
                      </button>
                      <span className="text-[10px] text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleSelectNoneEquipment}
                        className="text-[10px] text-slate-500 hover:underline font-medium"
                      >
                        សំអាត (Clear)
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                    {EQUIPMENT_LIST.map(eq => {
                      const isChecked = checkedEquipment.includes(eq.id);
                      return (
                        <button
                          type="button"
                          key={eq.id}
                          onClick={() => toggleEquipment(eq.id)}
                          className="w-full flex items-center text-left py-1.5 px-2 hover:bg-white rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                          )}
                          <span className={`font-semibold ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>
                            {eq.nameKh}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Special note / comment */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">ចំណាំ / ព័ត៌មានលម្អិតបន្ថែម (Note / Comment)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm h-16 min-h-[60px] max-h-[120px]"
                placeholder="បញ្ចូលចំណាំផ្សេងៗ (បើមាន)... ឧ. ម៉ាស៊ីនព្រីន Bizhub 458e ខូចកាត ឬដំណើរការល្អទាំងអស់"
              />
            </div>
          </div>

          {/* Footer actions inside form */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md"
            >
              {isSubmitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
