import { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  KeyRound, 
  Link, 
  Save, 
  Trash2, 
  HelpCircle,
  AlertCircle,
  ExternalLink,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection,
  fetchStaffFromSupabase,
  pushStaffToSupabase,
  fetchReportsFromSupabase,
  pushReportsToSupabase,
  SupabaseConfig
} from '../utils/supabaseClient.ts';
import { DailyReport, StaffAssignment } from '../types.ts';

interface SupabaseSyncProps {
  localReports: DailyReport[];
  localStaff: StaffAssignment[];
  onDataSync: (reports: DailyReport[], staff: StaffAssignment[]) => void;
}

export default function SupabaseSync({ localReports, localStaff, onDataSync }: SupabaseSyncProps) {
  const [config, setConfig] = useState<SupabaseConfig>({
    url: '',
    anonKey: '',
    isConfigured: false,
    source: 'none',
  });

  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [syncingType, setSyncingType] = useState<'pull' | 'push' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize config state
  useEffect(() => {
    const activeConfig = getSupabaseConfig();
    setConfig(activeConfig);
    setInputUrl(activeConfig.url);
    setInputKey(activeConfig.anonKey);
  }, []);

  const handleSaveConfig = () => {
    if (!inputUrl.trim() || !inputKey.trim()) {
      alert('សូមបំពេញព័ត៌មានទាំងពីរឱ្យបានពេញលេញ!');
      return;
    }
    saveSupabaseConfig(inputUrl.trim(), inputKey.trim());
    const newConfig = getSupabaseConfig();
    setConfig(newConfig);
    setTestResult(null);
    setStatusMessage('💾 រក្សាទុកព័ត៌មានការភ្ជាប់ទៅកាន់ Browser (LocalStorage) បានជោគជ័យ!');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleClearConfig = () => {
    if (confirm('តើអ្នកពិតជាចង់សម្អាតព័ត៌មានការភ្ជាប់ដែលបានរក្សាទុកក្នុង Browser នេះមែនទេ?')) {
      saveSupabaseConfig('', '');
      setInputUrl('');
      setInputKey('');
      const newConfig = getSupabaseConfig();
      setConfig(newConfig);
      setTestResult(null);
      setStatusMessage('🔌 បានសម្អាតព័ត៌មានការកំណត់ពី Browser រួចរាល់។');
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const isConnected = await testSupabaseConnection();
      if (isConnected) {
        setTestResult('success');
      } else {
        setTestResult('failed');
      }
    } catch {
      setTestResult('failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handlePullData = async () => {
    const activeConfig = getSupabaseConfig();
    if (!activeConfig.isConfigured) {
      alert('សូមកំណត់ URL និង API Key របស់ Supabase ជាមុនសិន!');
      return;
    }

    setSyncingType('pull');
    setStatusMessage('🔄 កំពុងទាញយកទិន្នន័យពី Supabase (គាំទ្រការទាញទិន្នន័យលើសពី ១០០០ ជួរ)...');
    try {
      // 1. Fetch Staff Assignments
      const fetchedStaff = await fetchStaffFromSupabase();
      // 2. Fetch Daily Reports (Recursive pagination avoids default 1000 limit)
      const fetchedReports = await fetchReportsFromSupabase();

      // Update Parent and local states
      onDataSync(fetchedReports, fetchedStaff);

      setStatusMessage(`✅ ទាញទិន្នន័យជោគជ័យ! មន្ត្រីបង្គោល៖ ${fetchedStaff.length} នាក់, របាយការណ៍សរុប៖ ${fetchedReports.length} ជួរ (ទាញដោយជោគជ័យសូម្បីតែគម្រោងឥតគិតថ្លៃ Free Tier)`);
    } catch (err: any) {
      console.error(err);
      alert('បរាជ័យក្នុងការទាញយកទិន្នន័យ៖ ' + (err.message || String(err)));
      setStatusMessage('❌ បរាជ័យក្នុងការទាញយកទិន្នន័យពី Supabase');
    } finally {
      setSyncingType(null);
    }
  };

  const handlePushData = async () => {
    const activeConfig = getSupabaseConfig();
    if (!activeConfig.isConfigured) {
      alert('សូមកំណត់ URL និង API Key របស់ Supabase ជាមុនសិន!');
      return;
    }

    if (localReports.length === 0 && localStaff.length === 0) {
      alert('មិនមានទិន្នន័យមូលដ្ឋានដើម្បីបញ្ជូនទៅឡើយ!');
      return;
    }

    const confirmed = confirm(`តើអ្នកចង់បញ្ជូន (Push) ទិន្នន័យបច្ចុប្បន្នទៅកាន់ Supabase មែនទេ?\n- របាយការណ៍ក្នុងម៉ាស៊ីន៖ ${localReports.length} ជួរ\n- មន្ត្រីបង្គោល៖ ${localStaff.length} នាក់`);
    if (!confirmed) return;

    setSyncingType('push');
    setStatusMessage('🔄 កំពុងបញ្ជូនទិន្នន័យមូលដ្ឋានទៅកាន់ Supabase (Upsert & Batch Chunks)...');
    try {
      // 1. Push Staff
      if (localStaff.length > 0) {
        await pushStaffToSupabase(localStaff);
      }
      // 2. Push Reports
      if (localReports.length > 0) {
        await pushReportsToSupabase(localReports);
      }

      setStatusMessage('✅ បញ្ជូនទិន្នន័យទៅកាន់ Supabase (PUSH) ដោយជោគជ័យ!');
    } catch (err: any) {
      console.error(err);
      alert('បរាជ័យក្នុងការបញ្ជូនទិន្នន័យ៖ ' + (err.message || String(err)));
      setStatusMessage('❌ បរាជ័យក្នុងការបញ្ជូនទិន្នន័យទៅកាន់ Supabase');
    } finally {
      setSyncingType(null);
    }
  };

  return (
    <div className="space-y-6" id="supabase-sync-panel">
      {/* State & Sync Notification Bar */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium animate-fade-in ${
          statusMessage.includes('❌') 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : statusMessage.includes('✅') 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                ការកំណត់ការតភ្ជាប់ជាមួយ Supabase Database
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                គ្រប់គ្រងការរក្សាទុកទិន្នន័យរបាយការណ៍ និងមន្ត្រីបង្គោលតាមរយៈ Supabase ជំនួស Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {config.isConfigured ? (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                config.source === 'env' 
                  ? 'bg-teal-50 border border-teal-200 text-teal-700' 
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                <CheckCircle className="w-3.5 h-3.5" />
                បានភ្ជាប់ (ប្រភព៖ {config.source === 'env' ? 'Environment Variables' : 'Browser Config'})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                <XCircle className="w-3.5 h-3.5" />
                មិនទាន់កំណត់ការភ្ជាប់
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-5">
            {/* Supabase Project URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-slate-400" />
                Supabase Project URL (ចំណុចភ្ជាប់របស់គម្រោង)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  disabled={config.source === 'env'}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ស្វែងរកក្នុង Supabase ៖ Project Settings → API → Project URL
              </p>
            </div>

            {/* Supabase Anon API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                Supabase Project API Key (anon/public Key)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  disabled={config.source === 'env'}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-3.5 pr-10 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ស្វែងរកក្នុង Supabase ៖ Project Settings → API → Project API keys (anon public)
              </p>
            </div>
          </div>

          {config.source === 'env' && (
            <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl text-[11px] text-sky-800 flex items-start gap-2.5">
              <Lock className="w-4.5 h-4.5 text-sky-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">🔒 បានកំណត់តាមរយៈ Environment Variables រួចរាល់</p>
                <p className="text-[10px] text-sky-700/90 mt-0.5 leading-relaxed">
                  គម្រោងកំពុងអានការកំណត់ពីឯកសារប្រព័ន្ធ ឬ Vercel Settings រួចជាស្រេច។ ប្រព័ន្ធបានបិទការកែប្រែដោយដៃដើម្បីធានាសុវត្ថិភាពខ្ពស់។
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2">
              {config.source !== 'env' && (
                <>
                  <button
                    onClick={handleSaveConfig}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    រក្សាទុកការកំណត់
                  </button>

                  {config.isConfigured && (
                    <button
                      onClick={handleClearConfig}
                      className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      សម្អាតការកំណត់
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {config.isConfigured && (
                <>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    ពិនិត្យការតភ្ជាប់
                  </button>

                  <div className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold shadow-sm">
                    <CheckCircle className="w-4 h-4 text-teal-500" />
                    ប្រព័ន្ធដំណើរការ Online & សមកាលកម្មស្វ័យប្រវត្ត (Auto-Sync)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Test Status feedback */}
          {testResult === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[11px] font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>ការតភ្ជាប់ទៅកាន់ Supabase ទទួលបានជោគជ័យ! តារាង (Tables) ទាំងអស់មានដំណើរការធម្មតា។</span>
            </div>
          )}

          {testResult === 'failed' && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-[11px] font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span>ការតភ្ជាប់បរាជ័យ៖ សូមពិនិត្យមើល URL, API Key ឡើងវិញ ឬប្រាកដថាបានបង្កើតតារាងក្នុង Supabase រួចរាល់។</span>
            </div>
          )}
        </div>
      </div>

      {/* Elegant Integration Instructions Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <HelpCircle className="w-4.5 h-4.5 text-indigo-500" />
          ណែនាំអំពីការរៀបចំប្រព័ន្ធ និងការភ្ជាប់ជាមួយ Supabase & Vercel
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] text-slate-600 leading-relaxed">
          {/* Section A: Supabase Schema Preparation */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-mono text-[10px] font-black">1</span>
              ជំហានបង្កើតទិន្នន័យលើ Supabase
            </h4>
            <ul className="list-decimal list-inside space-y-2 pl-1">
              <li>
                ចូលទៅកាន់គណនី <a href="https://database.new" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">Supabase <ExternalLink className="w-3 h-3 inline" /></a> រួចបង្កើតគម្រោងថ្មី (New Project)។
              </li>
              <li>
                ចុចលើផ្ទាំង <span className="font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">SQL Editor</span> នៅក្នុងផ្ទាំងបញ្ជារបស់ Supabase។
              </li>
              <li>
                បើកឯកសារ <span className="font-bold text-indigo-600 bg-slate-50 border border-slate-100 px-1 py-0.5 rounded">src/supabase_schema.sql</span> នៅក្នុងកូដប្រភពរបស់អ្នក។
              </li>
              <li>
                ចម្លង (Copy) កូដ SQL ទាំងអស់ រួចយកទៅដំណើរការ (Run) នៅក្នុង Supabase SQL Editor ដើម្បីបង្កើតតារាង និងបញ្ចូលទិន្នន័យខេត្ត-ខណ្ឌទាំង ៣៣។
              </li>
            </ul>
          </div>

          {/* Section B: Vercel Deploy Config instructions */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-mono text-[10px] font-black">2</span>
              ការរៀបចំដាក់តម្លៃក្នុង Vercel
            </h4>
            <div className="space-y-2">
              <p>
                ដើម្បីឱ្យគេហទំព័រដែលបង្ហោះលើ Vercel (<a href="https://equiptracker-xi.vercel.app/" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">equiptracker-xi.vercel.app <ExternalLink className="w-3 h-3 inline" /></a>) អាចភ្ជាប់ស្វ័យប្រវត្តទៅ Supabase៖
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1">
                <li>ចូលទៅកាន់គណនី Vercel Dashboard របស់គម្រោងនេះ។</li>
                <li>ចូលទៅកាន់ផ្ទាំង <span className="font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">Settings</span> រួចជ្រើសរើសយក <span className="font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">Environment Variables</span>។</li>
                <li>
                  បញ្ចូលអថេរចំនួន ២ ដូចខាងក្រោម៖
                  <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-[10px] text-slate-700 space-y-1 select-all">
                    <div><span className="text-pink-600 font-bold">VITE_SUPABASE_URL</span> = [Project URL របស់ Supabase]</div>
                    <div><span className="text-pink-600 font-bold">VITE_SUPABASE_ANON_KEY</span> = [API anon key របស់ Supabase]</div>
                  </div>
                </li>
                <li>ចុច <span className="font-bold text-slate-800">Save</span> រួចធ្វើការ <span className="font-bold text-slate-800">Redeploy</span> គម្រោងលើ Vercel ជាការស្រេច!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
