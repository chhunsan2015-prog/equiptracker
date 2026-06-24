/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Branch, DailyReport, StaffAssignment, SheetConnectionState } from './types.ts';
import { DEFAULT_BRANCHES, EQUIPMENT_LIST } from './constants.ts';
import {
  getLocalReports,
  saveLocalReports,
  getLocalStaff,
  saveLocalStaff,
  pullSettingsFromSheet,
  pushSettingsToSheet,
  pullReportsFromSheet,
  saveReportsToSheet,
  createGoogleSpreadsheet,
} from './utils/googleSheets.ts';

import ReportGrid from './components/ReportGrid.tsx';
import DashboardStats from './components/DashboardStats.tsx';
import StaffSettings from './components/StaffSettings.tsx';
import GoogleSheetsSync from './components/GoogleSheetsSync.tsx';
import ReportFormModal from './components/ReportFormModal.tsx';

import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileSpreadsheet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Database,
  Shield,
  HelpCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

export default function App() {
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'staff' | 'sync'>('dashboard');
  const [filterType, setFilterType] = useState<'all' | 'province' | 'khan'>('all');

  // Time States (Defaults to Today's Year-Month-Day)
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Core Data States
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES);

  // Modal States
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Google Sheets Connection & Auth States
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<SheetConnectionState>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    connectedAt: null,
    isLoading: false,
    error: null,
  });

  // Load initial dates on mount
  useEffect(() => {
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
    setSelectedDate(`${yr}-${mo}-${day}`);
  }, []);

  // Initialize data from LocalStorage
  useEffect(() => {
    setReports(getLocalReports());
    setStaff(getLocalStaff());

    const savedSheetId = localStorage.getItem('tax_tracker_spreadsheet_id');
    const savedSheetUrl = localStorage.getItem('tax_tracker_spreadsheet_url');
    const savedConnectedAt = localStorage.getItem('tax_tracker_spreadsheet_connected_at');
    const savedToken = localStorage.getItem('tax_tracker_access_token');

    if (savedSheetId) {
      setConnectionState(prev => ({
        ...prev,
        spreadsheetId: savedSheetId,
        spreadsheetUrl: savedSheetUrl || `https://docs.google.com/spreadsheets/d/${savedSheetId}`,
        connectedAt: savedConnectedAt || new Date().toISOString(),
      }));
    }

    if (savedToken) {
      setAccessToken(savedToken);
    }
  }, []);

  // Sync token caching
  const cacheAccessToken = (token: string) => {
    setAccessToken(token);
    localStorage.setItem('tax_tracker_access_token', token);
  };

  /**
   * Google sign-in implementation on client-side using standard Client ID
   * We will create a beautiful auth flow
   */
  const handleLoginWithGoogle = async () => {
    // Check if google client is loaded
    if (typeof window !== 'undefined' && (window as any).google) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          // Multi-tenant client ID / Sandbox Client ID
          client_id: '15405445209-679m9t5mkvm9s60qyy9h16n2q4m3o80j.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
          callback: (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              cacheAccessToken(tokenResponse.access_token);
              alert('🔑 បានភ្ជាប់គណនី Google ដោយជោគជ័យ!');
            } else {
              alert('ការតភ្ជាប់គណនីបានបរាជ័យ។');
            }
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        console.error('GIS Error:', err);
        // Fallback or developer instructions
        const manualToken = prompt('សូមបញ្ចូល Google OAuth Access Token ដោយផ្ទាល់ (ប្រសិនបើមិនអាចដំណើរការ Login Pop-up បាន)៖');
        if (manualToken && manualToken.trim()) {
          cacheAccessToken(manualToken.trim());
        }
      }
    } else {
      // Fallback manual input for absolute reliability
      const manualToken = prompt('Google API script មិនទាន់ហៅដំណើរការរួចរាល់... សូមបញ្ចូល Google OAuth Access Token របស់អ្នក បើសិនជាមាន៖');
      if (manualToken && manualToken.trim()) {
        cacheAccessToken(manualToken.trim());
      }
    }
  };

  const handleClearSession = () => {
    setAccessToken(null);
    localStorage.removeItem('tax_tracker_access_token');
    alert('🔌 បានផ្តាច់គណនី Google រួចរាល់។');
  };

  /**
   * Action: Connect to Google Sheet by Spreadsheet ID
   */
  const handleConnectSpreadsheet = async (id: string) => {
    if (!accessToken) {
      alert('សូមភ្ជាប់គណនី Google ជាមុនសិន!');
      return;
    }

    setConnectionState(p => ({ ...p, isLoading: true, error: null }));
    try {
      // Test pull settings
      const staffList = await pullSettingsFromSheet(id, accessToken);
      setStaff(staffList);

      const reportList = await pullReportsFromSheet(id, accessToken);
      setReports(reportList);

      const connectedTime = new Date().toISOString();
      const url = `https://docs.google.com/spreadsheets/d/${id}`;

      // Save to states and localStorage
      localStorage.setItem('tax_tracker_spreadsheet_id', id);
      localStorage.setItem('tax_tracker_spreadsheet_url', url);
      localStorage.setItem('tax_tracker_spreadsheet_connected_at', connectedTime);

      setConnectionState({
        spreadsheetId: id,
        spreadsheetUrl: url,
        connectedAt: connectedTime,
        isLoading: false,
        error: null,
      });

      alert('连接成功! ✅ បានភ្ជាប់ Google Sheet ដោយជោគជ័យ!');
    } catch (err) {
      setConnectionState(p => ({
        ...p,
        isLoading: false,
        error: err instanceof Error ? err.message : 'បរាជ័យក្នុងការតភ្ជាប់ Google Sheet។',
      }));
    }
  };

  /**
   * Action: Create and setup fresh Spreadsheet in Google Drive
   */
  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) {
      alert('សូមភ្ជាប់គណនី Google ជាមុនសិន!');
      return;
    }

    setConnectionState(p => ({ ...p, isLoading: true, error: null }));
    try {
      const result = await createGoogleSpreadsheet(accessToken);
      
      // Save Connection Info
      const connectedTime = new Date().toISOString();
      localStorage.setItem('tax_tracker_spreadsheet_id', result.id);
      localStorage.setItem('tax_tracker_spreadsheet_url', result.url);
      localStorage.setItem('tax_tracker_spreadsheet_connected_at', connectedTime);

      setConnectionState({
        spreadsheetId: result.id,
        spreadsheetUrl: result.url,
        connectedAt: connectedTime,
        isLoading: false,
        error: null,
      });

      // Fetch newly created defaults
      const staffList = getLocalStaff();
      setStaff(staffList);

      alert(`✅ បង្កើត និងរៀបចំឯកសារ Google Sheet ថ្មីដោយជោគជ័យ!\n\nSpreadsheet ID: ${result.id}`);
    } catch (err) {
      setConnectionState(p => ({
        ...p,
        isLoading: false,
        error: err instanceof Error ? err.message : 'បរាជ័យក្នុងការបង្កើត Google Sheet ថ្មី។',
      }));
      alert('កំហុសពេលបង្កើត Sheet៖ ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  /**
   * Action: Push Local Settings and Reports to Sheet
   */
  const handlePushData = async () => {
    const { spreadsheetId } = connectionState;
    if (!spreadsheetId || !accessToken) {
      alert('សូមភ្ជាប់ Google Sheet និងគណនី Google ជាមុនសិន!');
      return;
    }

    setConnectionState(p => ({ ...p, isLoading: true }));
    try {
      // 1. Push staff settings
      await pushSettingsToSheet(spreadsheetId, accessToken, staff);
      // 2. Push / Sync reports
      await saveReportsToSheet(spreadsheetId, accessToken, reports);

      alert('📊 បញ្ជូនទិន្នន័យ (PUSH) ទៅ Google Sheet ដោយជោគជ័យ!');
    } catch (err) {
      alert('កំហុសសមកាលកម្ម PUSH៖ ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConnectionState(p => ({ ...p, isLoading: false }));
    }
  };

  /**
   * Action: Pull Data from Sheets
   */
  const handlePullData = async () => {
    const { spreadsheetId } = connectionState;
    if (!spreadsheetId || !accessToken) {
      alert('សូមភ្ជាប់ Google Sheet និងគណនី Google ជាមុនសិន!');
      return;
    }

    setConnectionState(p => ({ ...p, isLoading: true }));
    try {
      // 1. Pull settings
      const staffList = await pullSettingsFromSheet(spreadsheetId, accessToken);
      setStaff(staffList);

      // 2. Pull reports
      const reportList = await pullReportsFromSheet(spreadsheetId, accessToken);
      setReports(reportList);

      alert('📊 ទាញយកទិន្នន័យ (PULL) ពី Google Sheet ដោយជោគជ័យ!');
    } catch (err) {
      alert('កំហុសសមកាលកម្ម PULL៖ ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConnectionState(p => ({ ...p, isLoading: false }));
    }
  };

  /**
   * Action: Save Staff assignment (locally and sheets if connected)
   */
  const handleSaveStaffAssignments = async (updatedStaff: StaffAssignment[]) => {
    setStaff(updatedStaff);
    saveLocalStaff(updatedStaff);

    if (connectionState.spreadsheetId && accessToken) {
      try {
        await pushSettingsToSheet(connectionState.spreadsheetId, accessToken, updatedStaff);
      } catch (err) {
        console.warn('Failed to auto-sync staff details with Google Sheet. Values saved locally.', err);
      }
    }
  };

  /**
   * Action: Submit a single daily report (locally and sheets if connected)
   */
  const handleReportSubmit = async (newReport: DailyReport) => {
    const updatedReports = [
      ...reports.filter(r => !(r.date === newReport.date && r.branchId === newReport.branchId)),
      newReport,
    ];
    
    setReports(updatedReports);
    saveLocalReports(updatedReports);

    if (connectionState.spreadsheetId && accessToken) {
      try {
        await saveReportsToSheet(connectionState.spreadsheetId, accessToken, [newReport]);
      } catch (err) {
        console.warn('Failed to auto-sync reports with Google Sheet. Values saved locally.', err);
      }
    }
  };

  /**
   * Trigger modal on cell clicked in monthly matrix
   */
  const handleCellClick = (branchId: string, dateStr: string) => {
    setSelectedBranchId(branchId);
    setSelectedDate(dateStr);
    setIsReportModalOpen(true);
  };

  /**
   * Date change arithmetic (previous/next day)
   */
  const handleDayShift = (amount: number) => {
    if (!selectedDate) return;
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + amount);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${yr}-${mo}-${day}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Convert Date selection back to Month string to keep them synced
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        const monStr = `${parts[0]}-${parts[1]}`;
        if (monStr !== selectedMonth) {
          setSelectedMonth(monStr);
        }
      }
    }
  }, [selectedDate, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800">
      
      {/* Upper Navigation & GDT Branded Header */}
      <header className="bg-[#1b4332] text-white py-4.5 px-6 shadow-md border-b-4 border-[#b7945d] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Khmer Title */}
          <div className="flex items-center gap-3">
            {/* Cambodian GDT Styling Shield Emblem */}
            <div className="w-11 h-11 bg-[#b7945d]/10 rounded-xl flex items-center justify-center shadow-lg border border-amber-300/50 flex-shrink-0">
              <img 
                src="/Logo5.png" 
                alt="Logo" 
                className="w-9 h-9 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-bold text-base md:text-lg tracking-tight text-amber-200">
                ប្រព័ន្ធកម្មវិធីតាមដានក្រុមការងារ និងការរាយការណ៍ឧបករណ៍
              </h1>
              <p className="text-[11px] text-emerald-100 font-medium">
                សាខាពន្ធដារខេត្ត (២៤ ខេត្ត) និង សាខាពន្ធដារខណ្ឌ (៩ ខណ្ឌ)
              </p>
            </div>
          </div>

          {/* Quick Date Picker / Navigator on Header */}
          <div className="flex items-center gap-2 bg-[#122e22] px-3.5 py-1.5 rounded-xl border border-emerald-800/40 w-full md:w-auto justify-between">
            <button
              onClick={() => handleDayShift(-1)}
              className="p-1 hover:bg-emerald-800 rounded transition text-emerald-200"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-0 w-32 text-center cursor-pointer font-mono"
            />
            <button
              onClick={() => handleDayShift(1)}
              className="p-1 hover:bg-emerald-800 rounded transition text-emerald-200"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Links & View Sorter */}
      <div className="bg-white border-b border-slate-100 py-3 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Active Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              ផ្ទាំងគ្រប់គ្រងប្រចាំថ្ងៃ
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              តារាងតាមដានប្រចាំខែ
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'staff'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4" />
              សមាជិកប្រចាំការ
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Google Sheet Sync
            </button>
          </div>

          {/* Sync status indicator */}
          <div className="flex items-center gap-3">
            {/* Category filter when in Matrix/Grid */}
            {activeTab === 'matrix' && (
              <div className="flex bg-slate-100 p-0.5 rounded-lg border text-xs">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${filterType === 'all' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ទាំងអស់
                </button>
                <button
                  onClick={() => setFilterType('province')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${filterType === 'province' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ខេត្ត
                </button>
                <button
                  onClick={() => setFilterType('khan')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${filterType === 'khan' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ខណ្ឌ
                </button>
              </div>
            )}

            {/* Offline/Online state indicator */}
            <div className="text-xs">
              {connectionState.spreadsheetId ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  តំណភ្ជាប់សកម្ម
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  ដំណើរការក្នុងម៉ាស៊ីន (Offline)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Quick Date Reminder Box */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
            <Calendar className="w-5 h-5 text-amber-600" />
            <span>កាលបរិច្ឆេទត្រួតពិនិត្យ៖ <span className="text-amber-800 font-mono text-sm bg-amber-100 px-2.5 py-0.5 rounded-lg">{selectedDate}</span></span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">ជ្រើសរើសខែសម្រាប់តារាង៖</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Tab content conditional routing */}
        <div className="transition-all duration-300">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Daily view section: Stats */}
              <DashboardStats
                branches={branches}
                reports={reports}
                staff={staff}
                selectedDate={selectedDate}
                selectedMonth={selectedMonth}
                onBranchSelect={(bId) => handleCellClick(bId, selectedDate)}
              />
              
              {/* Quick Record shortcut card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                  <PlusCircle className="w-5 h-5 text-emerald-600" />
                  ចុចបញ្ចូលរបាយការណ៍រហ័ស (Quick Daily Record)
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  ជ្រើសរើសសាខាដើម្បីបញ្ចូលរបាយការណ៍ត្រួតពិនិត្យឧបករណ៍ (Server Room, Video Conference, QMS, Printer, FaceScan, CCTV) ប្រចាំថ្ងៃ៖
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {branches.map(b => {
                    const hasReportedToday = reports.some(r => r.date === selectedDate && r.branchId === b.id && r.status === 'POSTED');
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleCellClick(b.id, selectedDate)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer shadow-sm truncate ${
                          hasReportedToday
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50'
                            : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        title={b.nameKh}
                      >
                        {b.nameKh}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'matrix' && (
            <ReportGrid
              branches={branches}
              reports={reports}
              staff={staff}
              selectedMonth={selectedMonth}
              onCellClick={handleCellClick}
              filterType={filterType}
            />
          )}

          {activeTab === 'staff' && (
            <StaffSettings
              branches={branches}
              staff={staff}
              onSaveStaff={handleSaveStaffAssignments}
              isSyncing={connectionState.isLoading}
              isSheetsConnected={!!connectionState.spreadsheetId}
            />
          )}

          {activeTab === 'sync' && (
            <GoogleSheetsSync
              connectionState={connectionState}
              accessToken={accessToken}
              onConnect={handleConnectSpreadsheet}
              onCreateNewSheet={handleCreateNewSpreadsheet}
              onPullData={handlePullData}
              onPushData={handlePushData}
              onLoginWithGoogle={handleLoginWithGoogle}
              onClearSession={handleClearSession}
            />
          )}

        </div>
      </main>

      {/* Floating daily entry review modal */}
      <ReportFormModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReportSubmit}
        selectedBranchId={selectedBranchId}
        selectedDate={selectedDate}
        branches={branches}
        staff={staff}
        reports={reports}
      />

      {/* Simple Professional footer */}
      <footer className="bg-slate-100 border-t border-slate-200 text-center py-5 mt-auto text-slate-400 text-xs font-medium">
        <p>© ២០២៦ ប្រព័ន្ធត្រួតពិនិត្យ និងតាមដានឧបករណ៍បច្ចេកវិទ្យាព័ត៌មាន សាខាពន្ធដារខេត្ត-ខណ្ឌ។ រក្សាសិទ្ធិគ្រប់យ៉ាង។</p>
      </footer>
    </div>
  );
}
