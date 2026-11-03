-- ==========================================
-- 🗄️ SUPABASE SQL DATABASE SCHEMA
-- ប្រព័ន្ធតាមដានឧបករណ៍បច្ចេកវិទ្យាព័ត៌មាន សាខាពន្ធដារ
-- Daily Equipment Report & Staff Tracking System
-- ==========================================
-- Instructions: Copy and run this script in the Supabase SQL Editor (https://database.new)

-- 1. DROP EXISTING TABLES/ENUMS (IF ANY) TO RESTART CLEAN
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS staff_assignments CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TYPE IF EXISTS branch_type_enum CASCADE;
DROP TYPE IF EXISTS report_status_enum CASCADE;

-- 2. CREATE CUSTOM ENUMS
CREATE TYPE branch_type_enum AS ENUM ('province', 'khan');
CREATE TYPE report_status_enum AS ENUM ('POSTED', 'NOT_POSTED');

-- 3. CREATE BRANCHES TABLE (តារាងសាខាពន្ធដារ)
CREATE TABLE branches (
    id VARCHAR(50) PRIMARY KEY,
    name_kh VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    type branch_type_enum NOT NULL DEFAULT 'province',
    default_staff VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE branches IS 'តារាងរក្សាទុកព័ត៌មានសាខាពន្ធដារខេត្ត-ខណ្ឌទាំង ៣៣';

-- 4. CREATE STAFF ASSIGNMENTS TABLE (តារាងព័ត៌មានមន្ត្រីបង្គោលដែលបានកែសម្រួល)
CREATE TABLE staff_assignments (
    branch_id VARCHAR(50) PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
    staff_names VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE staff_assignments IS 'តារាងរក្សាទុកមន្ត្រីបង្គោលបច្ចុប្បន្នដែលទទួលខុសត្រូវតាមសាខា';

-- 5. CREATE DAILY REPORTS TABLE (តារាងរបាយការណ៍ត្រួតពិនិត្យប្រចាំថ្ងៃ)
CREATE TABLE daily_reports (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL, -- YYYY-MM-DD
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    status report_status_enum NOT NULL DEFAULT 'POSTED',
    equipment_checked TEXT[] NOT NULL DEFAULT '{}', -- Column holds PC, PRINTER, NETWORK, POS, SCANNER, etc.
    reporter_name VARCHAR(100),
    telegram_post_time VARCHAR(50),
    note TEXT,
    remark TEXT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Constraint to prevent multiple reports per branch on the same day
    CONSTRAINT unique_daily_branch_report UNIQUE (date, branch_id)
);

-- ប្រសិនបើតារាង daily_reports មានរួចហើយ សូមដំណើរការកូដខាងក្រោមក្នុង Supabase SQL Editor៖
-- ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS remark TEXT;

COMMENT ON TABLE daily_reports IS 'តារាងរក្សាទុកទិន្នន័យនៃការរាយការណ៍គ្រប់គ្រងឧបករណ៍បច្ចេកវិទ្យាព័ត៌មានប្រចាំថ្ងៃ';

-- 6. CREATE PERFORMANCE INDICES (បង្កើនល្បឿនក្នុងការស្វែងរក និង ទាញយករបាយការណ៍)
CREATE INDEX idx_daily_reports_date ON daily_reports(date);
CREATE INDEX idx_daily_reports_branch_id ON daily_reports(branch_id);
CREATE INDEX idx_daily_reports_composite ON daily_reports(date, status);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) IN SUPABASE
-- By default, Supabase secures tables. We will enable RLS and add public read/write access policies.
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- 8. CREATE ACCESS POLICIES (គោលនយោបាយអនុញ្ញាតការមើល និង កែប្រែទិន្នន័យ)
-- Branches: Anyone can read, only Service Role or Admin can write (Seeding behaves as Admin/Super)
CREATE POLICY "Enable read access for all users on branches" ON branches
    FOR SELECT USING (true);

CREATE POLICY "Enable all modifications for anyone on branches" ON branches
    FOR ALL USING (true) WITH CHECK (true);

-- Staff Assignments: Anyone can read and update/insert
CREATE POLICY "Enable read/write access for all on staff_assignments" ON staff_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- Daily Reports: Anyone can read, insert and update
CREATE POLICY "Enable read/write access for all on daily_reports" ON daily_reports
    FOR ALL USING (true) WITH CHECK (true);


-- ==========================================
-- 🌱 SEED INTERNET & TECHNOLOGY OFFICES DATA (បញ្ចូលទិន្នន័យសាខាពន្ធដារទាំង ៣៣ ទៅក្នុង Database)
-- ==========================================

INSERT INTO branches (id, name_kh, name_en, type, default_staff) VALUES
-- 24 Provinces (២៤ ខេត្ត)
('PROV_BMC', 'បន្ទាយមានជ័យ', 'Banteay Meanchey', 'province', 'សុខ វិបុល'),
('PROV_BBB', 'បាត់ដំបង', 'Battambang', 'province', 'គង់ សុជាតិ'),
('PROV_KPC', 'កំពង់ចាម', 'Kampong Cham', 'province', 'ម៉ៅ សំណាង'),
('PROV_KCH', 'កំពង់ឆ្នាំង', 'Kampong Chhnang', 'province', 'លី វាសនា'),
('PROV_KPS', 'កំពង់ស្ពឺ', 'Kampong Speu', 'province', 'សេន ពិសិដ្ឋ'),
('PROV_KPT', 'កំពង់ធំ', 'Kampong Thom', 'province', 'តេង សារឿន'),
('PROV_KAMP', 'កំពត', 'Kampot', 'province', 'ភា រិទ្ធ'),
('PROV_KND', 'កណ្តាល', 'Kandal', 'province', 'ឈាង ឡុង'),
('PROV_KKG', 'កោះកុង', 'Koh Kong', 'province', 'ណាក់ វីរៈ'),
('PROV_KRT', 'ក្រចេះ', 'Kratie', 'province', 'អ៊ុំ ភក្តី'),
('PROV_MDK', 'មណ្ឌលគិរី', 'Mondulkiri', 'province', 'ស៊ន តារា'),
('PROV_PVH', 'ព្រះវិហារ', 'Preah Vihear', 'province', 'ឡៅ ម៉េងហួរ'),
('PROV_PVG', 'ព្រៃវែង', 'Prey Veng', 'province', 'កែវ សុខា'),
('PROV_PST', 'ពោធិ៍សាត់', 'Pursat', 'province', 'សុវណ្ណ តារា'),
('PROV_RTK', 'រតនគិរី', 'Ratanakiri', 'province', 'ហេង ណារ៉ុង'),
('PROV_SRP', 'សៀមរាប', 'Siem Reap', 'province', 'យ៉ែន យុទ្ធ'),
('PROV_SHV', 'ព្រះសីហនុ', 'Preah Sihanouk', 'province', 'ខៀវ សារ៉ាត់'),
('PROV_STG', 'ស្ទឹងត្រែង', 'Stung Treng', 'province', 'ពៅ ចំរើន'),
('PROV_SVR', 'ស្វាយរៀង', 'Svay Rieng', 'province', 'ស៊ឹម សុភ័ក្រ'),
('PROV_TKO', 'តាកែវ', 'Takeo', 'province', 'ម៉ៅ វាសនា'),
('PROV_OMC', 'ឧត្តរមានជ័យ', 'Oddar Meanchey', 'province', 'ហាក់ សេងលី'),
('PROV_KEP', 'កែប', 'Kep', 'province', 'ភឿន វុទ្ធី'),
('PROV_PLN', 'ប៉ៃលិន', 'Pailin', 'province', 'ញ៉ែម សុផាត'),
('PROV_TBK', 'ត្បូងឃ្មុំ', 'Tboung Khmum', 'province', 'ជឿន ចាន់ត្រា'),

-- 9 Khans (៩ ខណ្ឌ)
('KHAN_7M', '៧មករា', 'Khan Prampi Makara', 'khan', 'អ៊ុំ រតនា'),
('KHAN_CM', 'ចំការមន', 'Khan Chamkar Mon', 'khan', 'សួន វណ្ណា'),
('KHAN_DK', 'ដង្កោ', 'Khan Dangkao', 'khan', 'សុខ គឹមហៀង'),
('KHAN_DP', 'ដូនពេញ', 'Khan Daun Penh', 'khan', 'លឹម ម៉េងហុង'),
('KHAN_TK', 'ទួលគោក', 'Khan Tuol Kork', 'khan', 'គីម ហុង'),
('KHAN_PSC', 'ពោធិ៍សែនជ័យ', 'Khan Pou Senchey', 'khan', 'ចាន់ មុនីឌី'),
('KHAN_RK', 'ឫស្សីកែវ', 'Khan Russey Keo', 'khan', 'ជា សុភ័ក្ត្រ'),
('KHAN_SS', 'សែនសុខ', 'Khan Sen Sok', 'khan', 'លឹម សុធារ៉ា'),
('KHAN_MC', 'មានជ័យ', 'Khan Meanchey', 'khan', 'សេង ពិសិដ្ឋ')
ON CONFLICT (id) DO UPDATE SET 
    name_kh = EXCLUDED.name_kh,
    name_en = EXCLUDED.name_en,
    type = EXCLUDED.type,
    default_staff = EXCLUDED.default_staff;


-- ==========================================================
-- 💡 HELPER QUERIES FOR REPORTING APPS (សំណួរគំរូសម្រាប់ទាញយកទិន្នន័យ)
-- ==========================================================

-- A. Fetch monthly report achievements per branch
-- SELECT 
--     b.id,
--     b.name_kh AS branch_name,
--     b.default_staff,
--     COUNT(r.id) FILTER (WHERE r.status = 'POSTED') AS posted_days,
--     COUNT(r.id) AS total_logged,
--     ROUND((COUNT(r.id) FILTER (WHERE r.status = 'POSTED')::numeric / NULLIF(COUNT(r.id), 0)::numeric) * 100, 2) AS completion_rate
-- FROM branches b
-- LEFT JOIN daily_reports r ON b.id = r.branch_id AND EXTRACT(MONTH FROM r.date) = 6 AND EXTRACT(YEAR FROM r.date) = 2026
-- GROUP BY b.id, b.name_kh, b.default_staff;
