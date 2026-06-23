/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Branch, StaffAssignment } from '../types.ts';
import { Users, Search, Edit2, Check, X, Phone, Save, Database, Shield } from 'lucide-react';

interface StaffSettingsProps {
  branches: Branch[];
  staff: StaffAssignment[];
  onSaveStaff: (updatedStaff: StaffAssignment[]) => Promise<void>;
  isSyncing: boolean;
  isSheetsConnected: boolean;
}

export default function StaffSettings({
  branches,
  staff,
  onSaveStaff,
  isSyncing,
  isSheetsConnected,
}: StaffSettingsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editMap, setEditMap] = useState<Record<string, { staffNames: string; phone: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'province' | 'khan'>('all');

  // Compile full current working list (combining staff with default if not found)
  const fullStaffList = useMemo(() => {
    return branches.map(b => {
      const pStaff = staff.find(s => s.branchId === b.id);
      return {
        branchId: b.id,
        branchName: b.nameKh,
        branchNameEn: b.nameEn,
        type: b.type,
        staffNames: pStaff ? pStaff.staffNames : b.defaultStaff,
        phone: pStaff?.phone || '',
      };
    });
  }, [branches, staff]);

  // Filtered list
  const filteredList = useMemo(() => {
    return fullStaffList.filter(item => {
      // Category filter
      if (activeCategory === 'province' && item.type !== 'province') return false;
      if (activeCategory === 'khan' && item.type !== 'khan') return false;

      // Search query
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return (
        item.branchName.toLowerCase().includes(q) ||
        item.branchNameEn.toLowerCase().includes(q) ||
        item.staffNames.toLowerCase().includes(q) ||
        item.phone.includes(q)
      );
    });
  }, [fullStaffList, activeCategory, searchQuery]);

  const handleStartEdit = (branchId: string, initialNames: string, initialPhone: string) => {
    setEditMap(prev => ({
      ...prev,
      [branchId]: { staffNames: initialNames, phone: initialPhone },
    }));
  };

  const handleCancelEdit = (branchId: string) => {
    setEditMap(prev => {
      const copy = { ...prev };
      delete copy[branchId];
      return copy;
    });
  };

  const handleFieldChange = (branchId: string, field: 'staffNames' | 'phone', val: string) => {
    setEditMap(prev => ({
      ...prev,
      [branchId]: {
        ...prev[branchId],
        [field]: val,
      },
    }));
  };

  const handleSaveSingle = async (branchId: string) => {
    const editedFields = editMap[branchId];
    if (!editedFields) return;

    setIsSaving(true);
    try {
      const updatedList = staff.map(s => {
        if (s.branchId === branchId) {
          return { ...s, staffNames: editedFields.staffNames, phone: editedFields.phone };
        }
        return s;
      });

      // If it didn't exist in original state, append it
      if (!staff.some(s => s.branchId === branchId)) {
        updatedList.push({
          branchId,
          staffNames: editedFields.staffNames,
          phone: editedFields.phone,
        });
      }

      await onSaveStaff(updatedList);
      handleCancelEdit(branchId);
    } catch (err) {
      alert('កំហុសពេលរក្សាទុក៖ ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header Panel */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            ការកែប្រែឈ្មោះក្រុមការងារប្រចាំការ (Staffing Assignments)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            អ្នកអាចកែប្រែឈ្មោះមន្ត្រីបច្ចេកវិទ្យាប្រចាំការតាមបណ្តាសាខាទាំង ២៤ ខេត្ត និង ៤ ខណ្ឌ។
          </p>
        </div>

        {/* Database Badge */}
        <div className="flex items-center gap-1.5 self-start md:self-auto">
          {isSheetsConnected ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <Database className="w-3.5 h-3.5" />
              ភ្ជាប់ Google Sheet
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              <Shield className="w-3.5 h-3.5" />
              រក្សាទុកក្នុងម៉ាស៊ីន (Offline/Local)
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Categories Tab selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ទាំងអស់ ({fullStaffList.length})
          </button>
          <button
            onClick={() => setActiveCategory('province')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'province'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            សាខាខេត្ត ({fullStaffList.filter(s => s.type === 'province').length})
          </button>
          <button
            onClick={() => setActiveCategory('khan')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'khan'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            សាខាខណ្ឌ ({fullStaffList.filter(s => s.type === 'khan').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ស្វែងរកសាខា ឬឈ្មោះបុគ្គលិក..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Grid List of Cards */}
      <div className="p-5 overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-400">
              រកមិនឃើញព័ត៌មានដែលស្វែងរកឡើយ។
            </div>
          ) : (
            filteredList.map(item => {
              const isEditing = !!editMap[item.branchId];
              const editedData = editMap[item.branchId];

              return (
                <div
                  key={item.branchId}
                  className={`border rounded-xl p-4 transition-all ${
                    isEditing
                      ? 'border-emerald-300 ring-4 ring-emerald-50 bg-emerald-50/10'
                      : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {/* Branch Identifier */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.type === 'province'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {item.type === 'province' ? 'ខេត្ត' : 'ខណ្ឌ'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">ID: {item.branchId}</span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm mb-1">{item.branchName}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mb-4">{item.branchNameEn}</p>

                  {/* Input Fields */}
                  {isEditing ? (
                    <div className="space-y-2.5 mt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ឈ្មោះបុគ្គលិកប្រចាំការ</label>
                        <input
                          type="text"
                          value={editedData.staffNames}
                          onChange={(e) => handleFieldChange(item.branchId, 'staffNames', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="បញ្ចូលឈ្មោះបុគ្គលិក..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">លេខទូរស័ព្ទ (Contact Phone)</label>
                        <input
                          type="text"
                          value={editedData.phone}
                          onChange={(e) => handleFieldChange(item.branchId, 'phone', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="ឧទាហរណ៍ ០១២ ៣៤៥ ៦៧៨"
                        />
                      </div>

                      {/* Action buttons while editing */}
                      <div className="flex justify-end gap-1.5 pt-2">
                        <button
                          onClick={() => handleCancelEdit(item.branchId)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveSingle(item.branchId)}
                          disabled={isSaving || !editedData.staffNames.trim()}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700">{item.staffNames}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">{item.phone || 'គ្មានលេខទូរស័ព្ទ'}</span>
                      </div>

                      {/* Edit Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleStartEdit(item.branchId, item.staffNames, item.phone)}
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Edit2 className="w-3 h-3" />
                          កែប្រែឈ្មោះ (Edit)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
