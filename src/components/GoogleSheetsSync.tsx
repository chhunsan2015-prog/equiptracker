/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SheetConnectionState } from '../types.ts';
import { FileSpreadsheet, Key, Database, RefreshCw, Check, AlertCircle, Plus, Copy, Link, LogIn, ExternalLink } from 'lucide-react';

interface GoogleSheetsSyncProps {
  connectionState: SheetConnectionState;
  accessToken: string | null;
  onConnect: (spreadsheetId: string) => Promise<void>;
  onCreateNewSheet: () => Promise<void>;
  onPullData: () => Promise<void>;
  onPushData: () => Promise<void>;
  onLoginWithGoogle: () => Promise<void>;
  onClearSession: () => void;
}

export default function GoogleSheetsSync({
  connectionState,
  accessToken,
  onConnect,
  onCreateNewSheet,
  onPullData,
  onPushData,
  onLoginWithGoogle,
  onClearSession,
}: GoogleSheetsSyncProps) {
  const [sheetInput, setSheetInput] = useState('');
  const [apiTokenInput, setApiTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  useEffect(() => {
    if (connectionState.spreadsheetId) {
      setSheetInput(connectionState.spreadsheetId);
    }
  }, [connectionState.spreadsheetId]);

  // Extracts sheet ID from full URL if pasted
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim()) return;

    let targetId = sheetInput.trim();
    // Check if it's a full Google Sheets URL
    // e.g. https://docs.google.com/spreadsheets/d/1X5u8T87wP4X9f/edit#gid=0
    const matches = targetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      targetId = matches[1];
    }

    setIsConnecting(true);
    try {
      await onConnect(targetId);
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('📋 បានចម្លង ID ទៅក្នុង Clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Google Sheets Dashboard HeaderCard */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                តភ្ជាប់ទិន្នន័យជាមួយ Google Sheets
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                គ្រប់គ្រងការតភ្ជាប់ ទាញយក និងបញ្ជូនរាយការណ៍គ្រប់គ្រងឧបករណ៍ទៅ Google Sheets។
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!accessToken ? (
              <button
                onClick={onLoginWithGoogle}
                className="gsi-material-button text-xs font-semibold px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Sign in with Google
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <Check className="w-3.5 h-3.5" />
                  គណនី Google បានភ្ជាប់
                </span>
                <button
                  onClick={onClearSession}
                  className="text-[10px] text-rose-500 hover:underline font-semibold cursor-pointer"
                >
                  ផ្តាច់គណនី (Disconnect Account)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Configure Connection */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <h4 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">
            ⚙️ កំណត់ឯកសាររក្សាទុក (Spreadsheet Configuration)
          </h4>

          {/* Create New Sheet */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-emerald-50/20 border border-slate-100">
            <div className="flex items-start gap-3 justify-between">
              <div>
                <h5 className="font-bold text-slate-800 text-sm">បង្កើតឯកសារ Google Sheet ថ្មី</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  បង្កើតតារាងរៀបចំរួចជាស្រេចស្វ័យប្រវត្តិក្នង Google Drive របស់អ្នក (រាយឈ្មោះសាខា ២៤ ខេត្ត និង ៤ ខណ្ឌ និងរូបរាងតារាងរាយការណ៍)។
                </p>
              </div>
              <button
                onClick={onCreateNewSheet}
                disabled={connectionState.isLoading || !accessToken}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                បង្កើតតារាងថ្មី
              </button>
            </div>
            {!accessToken && (
              <p className="text-[10px] text-amber-600 font-semibold mt-2.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                សូមចុច Google Sign In ជាមុនសិនទើបអាចបង្កើត Google Sheet បាន។
              </p>
            )}
          </div>

          {/* Connect Existing Sheet */}
          <form onSubmit={handleConnectSheet} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                តភ្ជាប់ដោយប្រើ Sheets URL ឬ ID៖
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isConnecting || connectionState.isLoading || !sheetInput.trim() || !accessToken}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition cursor-pointer flex-shrink-0"
                >
                  {isConnecting ? 'កំពុងតភ្ជាប់...' : 'តភ្ជាប់'}
                </button>
              </div>
            </div>

            {connectionState.error && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl flex items-start gap-2 text-xs border border-rose-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{connectionState.error}</span>
              </div>
            )}
          </form>

          {/* Current Connection Details */}
          {connectionState.spreadsheetId && (
            <div className="p-4 rounded-xl border border-slate-100 space-y-3">
              <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">ព័ត៌មានឯកសារគ្រោងឆ្អឹង (Current Target)</h5>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Spreadsheet ID៖</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border">
                      {connectionState.spreadsheetId.substring(0, 12)}...{connectionState.spreadsheetId.substring(connectionState.spreadsheetId.length - 8)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(connectionState.spreadsheetId || '')}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                      title="Copy Sreadsheet ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {connectionState.spreadsheetUrl && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">តំណរក្សាតារាង (Go to Sheet)៖</span>
                    <a
                      href={connectionState.spreadsheetUrl}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="text-emerald-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      បើកឯកសារ
                      <ExternalLink className="w-3" />
                    </a>
                  </div>
                )}

                {connectionState.connectedAt && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 font-medium">តភ្ជាប់ចុងក្រោយ (Connected At)៖</span>
                    <span className="text-slate-600 font-medium">
                      {new Date(connectionState.connectedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sync Actions & Sync Logs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <h4 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">
            🔄 សមកាលកម្មទិន្នន័យ (Database Sync Action)
          </h4>

          <p className="text-xs text-slate-500 leading-relaxed">
            នៅពេលអ្នកកែប្រែឈ្មោះមន្ត្រីប្រចាំការ ឬបញ្ចូលសេចក្តីរាយការណ៍ថ្មី វាត្រូវបានរក្សាទុកក្នងម៉ាស៊ីន (Local Storage) ជាបណ្តោះអាសន្ន។ សូមជ្រើសរើស៖
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pull Button */}
            <button
              onClick={onPullData}
              disabled={connectionState.isLoading || !connectionState.spreadsheetId || !accessToken}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 disabled:opacity-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 transition text-center cursor-pointer group"
            >
              <div className="p-3 bg-sky-50 text-sky-600 rounded-full group-hover:rotate-180 transition-transform duration-500">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-sm">ទាញយកពី Google Sheets (PULL)</span>
              <span className="text-[10px] text-slate-400">ទាញយកឈ្មោះបុគ្គលិក និងរាយការណ៍ពីតារាងមកកម្មវិធី</span>
            </button>

            {/* Push Button */}
            <button
              onClick={onPushData}
              disabled={connectionState.isLoading || !connectionState.spreadsheetId || !accessToken}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 disabled:opacity-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 transition text-center cursor-pointer group"
            >
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-800 text-sm">បញ្ជូនទៅ Google Sheets (PUSH)</span>
              <span className="text-[10px] text-slate-400">ប្រមូលរាយការណ៍ពីម៉ាស៊ីនរួចសរសេរបញ្ចូលទៅ Sheets</span>
            </button>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100 text-xs text-amber-800 space-y-1">
            <h5 className="font-bold flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" />
              ព័ត៌មានបន្ថែម៖
            </h5>
            <p>
              - កម្មវិធីនឹងរក្សាទុករបាយការណ៍ស្វ័យប្រវត្តិក្នង browser របស់អ្នកជានិច្ច ដើម្បីទប់ស្កាត់ការបាត់បង់ទិន្នន័យ។
            </p>
            <p>
              - PUSH នឹងបញ្ជូនទិន្នន័យទាំងអស់ពី Local ទៅ Google Sheet ហើយតម្រៀបតាមកាលបរិច្ឆេទដោយស្វ័យប្រវត្តិ។
            </p>
            <p>
              - Google Sheets ជួយអ្នកក្នុងកិច្ចការពារទិន្នន័យ ការិយាល័យ និងការងារជាក្រុមជាមួយមន្ត្រីផ្សេងទៀត។
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
