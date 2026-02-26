import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ClipboardList, FileText, CheckSquare, PlusCircle, 
  Edit, Trash2, Save, Menu, X, Upload, Download, Printer, Cloud, RefreshCw, CheckCircle2, ShieldCheck, Globe, CalendarDays
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  deleteDoc, updateDoc, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// ============================================================
// ⚠️ LANGKAH PENTING: PASTE KUNCI FIREBASE DI SINI
// ============================================================
// Padam {} di bawah dan paste kod dari Firebase Langkah 2 (Tab npm)
const myConfig = {}; 

// Sistem akan menggunakan config anda jika anda paste di atas.
const firebaseConfig = Object.keys(myConfig).length > 0 
  ? myConfig 
  : JSON.parse(__firebase_config);

// --- KONFIGURASI SISTEM ---
const SCHOOL_NAME = "SK SUNGAI HAJI DORANI";
const APP_NAME = "Laporan Harian RMT";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'skshd-rmt-cloud-2025';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); 
  const [reportsC8, setReportsC8] = useState([]); 
  const [reportsC7, setReportsC7] = useState([]); 
  
  const [loadingStatus, setLoadingStatus] = useState({ students: false, attendance: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [printMode, setPrintMode] = useState(null); 
  const [printMonth, setPrintMonth] = useState(new Date().toISOString().substring(0, 7));

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Ralat Firebase:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    const publicDataRef = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);

    const unsubStudents = onSnapshot(publicDataRef('students'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a, b) => {
        const classA = (a.className || "").toUpperCase();
        const classB = (b.className || "").toUpperCase();
        if (classA !== classB) return classA.localeCompare(classB);
        return (a.name || "").toUpperCase().localeCompare((b.name || "").toUpperCase());
      });
      setStudents(sortedData);
      setLoadingStatus(prev => ({ ...prev, students: true }));
    });

    const unsubAtt = onSnapshot(publicDataRef('attendance'), (snapshot) => {
      const attObj = {};
      snapshot.docs.forEach(doc => { attObj[doc.id] = doc.data().records || {}; });
      setAttendance(attObj);
      setLoadingStatus(prev => ({ ...prev, attendance: true }));
      setIsSyncing(false);
    });

    const unsubC8 = onSnapshot(publicDataRef('reportsC8'), (snapshot) => {
      setReportsC8(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.date.localeCompare(a.date)));
    });

    const unsubC7 = onSnapshot(publicDataRef('reportsC7'), (snapshot) => {
      setReportsC7(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.date.localeCompare(a.date)));
    });

    return () => { unsubStudents(); unsubAtt(); unsubC8(); unsubC7(); };
  }, [user]);

  const initializeAttendanceForDate = async (date) => {
    if (!loadingStatus.students || !loadingStatus.attendance || students.length === 0) return;
    if (attendance[date] && Object.keys(attendance[date]).length > 0) return; 
    const newRecord = {};
    students.forEach(s => { newRecord[s.id] = true; });
    try {
      setIsSyncing(true);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendance', date), {
        records: newRecord, updatedAt: Date.now(), initializedBy: user.uid
      });
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  if (!user || !loadingStatus.students || !loadingStatus.attendance) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="animate-spin text-emerald-400" size={32} />
          <p className="font-bold tracking-widest uppercase text-[10px]">Menghubungkan Awan SKSHD...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 text-sm overflow-hidden">
      {/* SIDEBAR */}
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 text-white shadow-xl z-20">
        <div className="p-5 bg-slate-950 flex flex-col items-center border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg mb-2 shadow-lg shadow-emerald-500/20"><Cloud size={20} /></div>
          <h1 className="text-sm font-black tracking-tighter uppercase">{APP_NAME}</h1>
          <span className="text-[8px] mt-1 font-bold text-emerald-400 opacity-70 uppercase tracking-widest">{SCHOOL_NAME}</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <SidebarItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<CheckSquare size={16}/>} label="Kehadiran (C9)" />
          <SidebarItem active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users size={16}/>} label="Urus Murid" />
          <SidebarItem active={activeTab === 'laporan-harian'} onClick={() => setActiveTab('laporan-harian')} icon={<ClipboardList size={16}/>} label="Laporan Harian" />
          <SidebarItem active={activeTab === 'pemantauan'} onClick={() => setActiveTab('pemantauan')} icon={<FileText size={16}/>} label="Pemantauan" />
        </nav>
        <div className="p-3 bg-slate-950/50 border-t border-slate-800 text-center">
            <span className="text-[7px] font-bold uppercase tracking-widest text-slate-500">
              {Object.keys(myConfig).length > 0 ? "Mod Peribadi Aktif" : "Mod Simulasi Preview"}
            </span>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-3 fixed top-0 w-full z-40 shadow-lg border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-emerald-400" />
          <h1 className="text-[10px] font-black uppercase tracking-tighter">{APP_NAME}</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 bg-slate-800 rounded-lg"><Menu size={16}/></button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[48px] bg-slate-900/98 backdrop-blur-md text-white z-30 flex flex-col p-6 animate-in fade-in slide-in-from-top">
          <MobileNavItem onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} label="Kehadiran (C9)" />
          <MobileNavItem onClick={() => {setActiveTab('students'); setIsMobileMenuOpen(false);}} label="Urus Murid" />
          <MobileNavItem onClick={() => {setActiveTab('laporan-harian'); setIsMobileMenuOpen(false);}} label="Laporan Harian" />
          <MobileNavItem onClick={() => {setActiveTab('pemantauan'); setIsMobileMenuOpen(false);}} label="Pemantauan" />
        </div>
      )}

      {/* KANDUNGAN UTAMA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-[48px] md:mt-0 relative">
        {activeTab === 'dashboard' && <TabKehadiranC9 students={students} attendance={attendance} getTodayDate={getTodayDate} initAttendance={initializeAttendanceForDate} isSyncing={isSyncing} setPrintMode={setPrintMode} printMonth={printMonth} setPrintMonth={setPrintMonth} />}
        {activeTab === 'students' && <TabUrusMurid students={students} setIsSyncing={setIsSyncing} setPrintMode={setPrintMode} />}
        {activeTab === 'laporan-harian' && <TabLaporanHarianC8 reports={reportsC8} attendance={attendance} students={students} getTodayDate={getTodayDate} initAttendance={initializeAttendanceForDate} setIsSyncing={setIsSyncing} setPrintMode={setPrintMode} />}
        {activeTab === 'pemantauan' && <TabPemantauanC7 reports={reportsC7} attendance={attendance} students={students} getTodayDate={getTodayDate} initAttendance={initializeAttendanceForDate} setIsSyncing={setIsSyncing} setPrintMode={setPrintMode} />}
      </main>

      {/* OVERLAY CETAKAN */}
      {printMode && (
        <div className="fixed inset-0 bg-white z-[9999] overflow-auto flex flex-col no-print">
          <PrintHeader 
            title={printMode} 
            recommendation={printMode === 'C9' || printMode === 'C8' ? 'Landscape' : 'Portrait'} 
            onPrint={() => { window.focus(); window.print(); }} 
            onClose={() => setPrintMode(null)} 
          />
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8">
            <div className="print-canvas mx-auto bg-white shadow-2xl p-6 md:p-12 overflow-x-auto">
              {printMode === 'C9' && <PrintContentC9 students={students} attendance={attendance} printMonth={printMonth} />}
              {printMode === 'C4' && <PrintContentC4 students={students} />}
              {printMode === 'C8' && <PrintContentC8 reports={reportsC8} />}
              {printMode === 'C7' && <PrintContentC7 reports={reportsC7} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SidebarItem = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    {icon} <span className="font-bold uppercase text-[9px] tracking-widest">{label}</span>
  </button>
);

const MobileNavItem = ({ label, onClick }) => (
  <button onClick={onClick} className="w-full text-center py-4 border-b border-slate-800 font-bold uppercase text-[10px] tracking-widest">{label}</button>
);

const Card = ({ children, title, actions }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-4">
    {(title || actions) && (
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
        {title && <h2 className="text-sm font-black text-slate-800 uppercase border-l-4 border-emerald-500 pl-3 leading-none">{title}</h2>}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

const PrintHeader = ({ title, recommendation, onPrint, onClose }) => (
  <div className="bg-slate-900 text-white p-3 border-b border-slate-800 flex justify-between items-center shadow-xl sticky top-0 z-50">
     <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-white px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-widest">{title}</div>
        <p className="text-slate-400 font-bold text-[8px] uppercase tracking-widest hidden sm:block">Kertas: {recommendation}</p>
     </div>
     <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onPrint(); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-[9px] uppercase transition-all shadow-md active:scale-95 cursor-pointer">
           <Printer size={12} /> Cetak
        </button>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-lg font-bold text-[9px] uppercase transition-all active:scale-95 cursor-pointer">
           <X size={12} /> Tutup
        </button>
     </div>
  </div>
);

function TabKehadiranC9({ students, attendance, getTodayDate, initAttendance, isSyncing, setPrintMode, printMonth, setPrintMonth }) {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  useEffect(() => { initAttendance(selectedDate); }, [selectedDate, students.length]);
  const currentAtt = attendance[selectedDate] || {};
  const totalHadir = Object.values(currentAtt).filter(Boolean).length;
  const toggleAttendance = async (studentId) => {
    const updated = { ...currentAtt, [studentId]: !currentAtt[studentId] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendance', selectedDate), {
      records: updated, updatedAt: Date.now()
    });
  };
  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-6">
        <div>
          <h1 className="text-lg font-black text-slate-900 uppercase leading-none">Kehadiran (C9)</h1>
          <p className="text-slate-400 font-bold text-[8px] tracking-[0.2em] uppercase mt-1">{SCHOOL_NAME}</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-slate-200">
          <input type="month" value={printMonth} onChange={(e) => setPrintMonth(e.target.value)} className="bg-slate-50 px-2 py-1.5 rounded text-[10px] font-bold outline-none border border-slate-100" />
          <button onClick={() => setPrintMode('C9')} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-md font-bold text-[9px] uppercase hover:bg-emerald-700 shadow-sm transition-all active:scale-95">
            <Printer size={12} /> Cetak C9
          </button>
        </div>
      </div>
      <Card title="Penandaan Harian">
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <CheckSquare size={18} className="text-emerald-500" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="font-bold text-[11px] outline-none bg-transparent uppercase cursor-pointer" />
          </div>
          <div className="flex gap-4 items-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Kehadiran: <span className="text-emerald-600 text-sm ml-1">{totalHadir} / {students.length}</span></p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100">
              <tr><th className="p-3 w-10 text-center">BIL</th><th className="p-3">NAMA MURID</th><th className="p-3 w-20">KELAS</th><th className="p-3 w-32 text-center">TINDAKAN</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((s, idx) => {
                const isPresent = !!currentAtt[s.id];
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-center font-bold text-slate-300">{idx + 1}</td>
                    <td className="p-3">
                      <p className="font-bold uppercase text-slate-700 leading-tight mb-0.5">{s.name}</p>
                      <span className="text-[7px] font-bold text-slate-400 uppercase">{s.gender === 'L' ? 'LELAKI' : 'PEREMPUAN'}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-500 uppercase text-[9px]">{s.className}</td>
                    <td className="p-3">
                      <button onClick={() => toggleAttendance(s.id)} disabled={isSyncing} className={`w-full py-1.5 rounded-md font-bold text-[8px] uppercase tracking-widest transition-all ${isPresent ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                        {isPresent ? 'HADIR' : 'PONTENG'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TabUrusMurid({ students, setIsSyncing, setPrintMode }) {
  const [formData, setFormData] = useState({ id: '', name: '', className: '', gender: '' });
  const saveStudent = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    const id = formData.id || Date.now().toString();
    try {
      setIsSyncing(true);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), {
        ...formData, id, name: formData.name.toUpperCase(), className: (formData.className || "").toUpperCase()
      });
      setFormData({ id: '', name: '', className: '', gender: '' });
    } finally { setIsSyncing(false); }
  };
  return (
    <div className="animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-black text-slate-900 uppercase leading-none">Urus Murid</h1>
        <button onClick={() => setPrintMode('C4')} className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-md font-bold text-[9px] uppercase shadow-md hover:bg-slate-700">
          <Printer size={12} /> Cetak C4
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <Card title="Daftar Murid">
            <form onSubmit={saveStudent} className="space-y-3">
              <Input label="Nama Murid" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="CTH: AHMAD ALI" required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Kelas" value={formData.className} onChange={(e) => setFormData({...formData, className: e.target.value})} placeholder="1 AMANAH" />
                <Input label="Jantina (L/P)" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} maxLength={1} placeholder="L / P" />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                Simpan Murid
              </button>
            </form>
          </Card>
        </div>
        <div className="lg:col-span-8">
          <Card title={`Senarai Nama (${students.length})`}>
             <div className="overflow-x-auto rounded-lg border border-slate-100">
               <table className="w-full text-left text-[11px]">
                 <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                   <tr><th className="p-3 w-10 text-center">BIL</th><th className="p-3">NAMA</th><th className="p-3 text-right">TINDAKAN</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {students.map((s, i) => (
                     <tr key={s.id}>
                       <td className="p-3 text-center font-bold text-slate-300">{i + 1}</td>
                       <td className="p-3"><p className="font-bold uppercase text-slate-700 leading-none mb-1">{s.name}</p><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{s.className}</p></td>
                       <td className="p-3 text-right">
                         <button onClick={async () => {setIsSyncing(true); await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', s.id)); setIsSyncing(false);}} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TabLaporanHarianC8({ reports, setIsSyncing, setPrintMode, getTodayDate }) {
  const [formData, setFormData] = useState({ date: getTodayDate(), teacher: '', scoreMenu: '4', scoreTaste: '4', scoreHygiene: '4', scoreDiscipline: '4', notes: '' });
  const saveReport = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    const dayName = new Date(formData.date).toLocaleDateString('ms-MY', { weekday: 'long' }).toUpperCase();
    try {
      setIsSyncing(true);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reportsC8', id), { ...formData, id, dayName, updatedAt: Date.now() });
      setFormData({ date: getTodayDate(), teacher: '', scoreMenu: '4', scoreTaste: '4', scoreHygiene: '4', scoreDiscipline: '4', notes: '' });
    } finally { setIsSyncing(false); }
  };
  return (
    <div className="animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-black text-slate-900 uppercase leading-none">Laporan Harian (C8)</h1>
        <button onClick={() => setPrintMode('C8')} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-md font-bold text-[9px] uppercase shadow-md"><Printer size={12}/> Cetak C8</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <Card title="Tulis Laporan">
            <form onSubmit={saveReport} className="space-y-3">
               <Input label="Tarikh" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
               <Input label="Nama Guru Bertugas" value={formData.teacher} onChange={(e) => setFormData({...formData, teacher: e.target.value})} required uppercase />
               <div className="space-y-1">
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Catatan</p>
                 <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none h-20" placeholder="Kualiti makanan memuaskan..."/>
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase shadow-lg">Simpan Laporan</button>
            </form>
          </Card>
        </div>
        <div className="lg:col-span-8">
          <Card title="Rekod Log">
             <div className="space-y-2">
               {reports.map(r => (
                 <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                    <div><p className="font-bold text-[10px] uppercase text-slate-700">{r.date} ({r.dayName})</p><p className="text-[8px] font-bold text-slate-400 uppercase">GURU: {r.teacher}</p></div>
                    <button onClick={async () => {setIsSyncing(true); await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reportsC8', r.id)); setIsSyncing(false);}} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                 </div>
               ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TabPemantauanC7({ reports, setIsSyncing, setPrintMode, getTodayDate }) {
  const [formData, setFormData] = useState({ date: getTodayDate(), admin: '', teacher: '', comments: '' });
  const saveReport = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    try {
      setIsSyncing(true);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reportsC7', id), { ...formData, id, updatedAt: Date.now() });
      setFormData({ date: getTodayDate(), admin: '', teacher: '', comments: '' });
    } finally { setIsSyncing(false); }
  };
  return (
    <div className="animate-in fade-in">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-black text-slate-900 uppercase leading-none">Pemantauan (C7)</h1>
        <button onClick={() => setPrintMode('C7')} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-[9px] uppercase shadow-md"><Printer size={12}/> Cetak C7</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <Card title="Borang Pemantauan">
            <form onSubmit={saveReport} className="space-y-3">
               <Input label="Tarikh" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
               <Input label="Nama Pemantau" value={formData.admin} onChange={(e) => setFormData({...formData, admin: e.target.value})} required uppercase placeholder="GB / GPK HEM" />
               <Input label="Guru Bertugas" value={formData.teacher} onChange={(e) => setFormData({...formData, teacher: e.target.value})} uppercase />
               <div className="space-y-1">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none">Ulasan</p>
                 <textarea value={formData.comments} onChange={(e) => setFormData({...formData, comments: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none h-24" />
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase shadow-lg">Hantar C7</button>
            </form>
          </Card>
        </div>
        <div className="lg:col-span-8">
          <Card title="Rekod Lawatan">
             <div className="space-y-2">
               {reports.map(r => (
                 <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                    <div><p className="font-bold text-[10px] uppercase text-slate-700">{r.date} - {r.admin}</p></div>
                    <button onClick={async () => {setIsSyncing(true); await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reportsC7', r.id)); setIsSyncing(false);}} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
                 </div>
               ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN CETAKAN ---

const PrintContentC9 = ({ students, attendance, printMonth }) => {
  const [pYear, pMonth] = printMonth.split('-').map(Number);
  const dateObj = new Date(pYear, pMonth - 1, 1);
  const daysInMonth = new Date(pYear, pMonth, 0).getDate();
  return (
    <div className="text-black uppercase">
      <div className="flex justify-between items-end mb-6">
        <div>
           <h2 className="font-bold text-lg underline">REKOD KEHADIRAN MURID RMT</h2>
           <p className="text-[10px] font-bold">BULAN: {dateObj.toLocaleString('ms-MY', {month: 'long', year: 'numeric'})}</p>
           <p className="text-[10px] font-bold">SEKOLAH: {SCHOOL_NAME}</p>
        </div>
        <div className="border-4 border-black px-4 py-1 text-xl font-black">BORANG C9</div>
      </div>
      <table className="w-full border-collapse border border-black text-[7px] text-center">
        <thead>
          <tr className="bg-gray-100 font-bold border border-black">
            <th className="border border-black p-1 w-6">BIL</th>
            <th className="border border-black p-1 text-left px-2">NAMA PENUH MURID</th>
            <th className="border border-black p-1 w-10">KELAS</th>
            {[...Array(31)].map((_, i) => (<th key={i} className="border border-black p-0.5 w-3">{i + 1}</th>))}
            <th className="border border-black p-1 w-10">JUMLAH</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, idx) => {
             let count = 0;
             return (
              <tr key={s.id}>
                <td className="border border-black p-1">{idx + 1}</td>
                <td className="border border-black p-1 text-left px-2">{s.name}</td>
                <td className="border border-black p-1">{s.className}</td>
                {[...Array(31)].map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  if (day > daysInMonth) return <td key={dayIdx} className="border border-black bg-gray-200"></td>;
                  const checkDate = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isWeekend = new Date(checkDate).getDay() === 0 || new Date(checkDate).getDay() === 6;
                  const status = (attendance[checkDate] || {})[s.id];
                  if (isWeekend) return <td key={dayIdx} className="border border-black bg-gray-100 text-[5px]">C</td>;
                  if (status === true) { count++; return <td key={dayIdx} className="border border-black">/</td>; }
                  if (status === false) return <td key={dayIdx} className="border border-black text-red-600 font-bold">O</td>;
                  return <td key={dayIdx} className="border border-black"></td>;
                })}
                <td className="border border-black font-bold">{count}</td>
              </tr>
             )
          })}
        </tbody>
      </table>
    </div>
  );
};

const PrintContentC4 = ({ students }) => (
  <div className="text-black uppercase text-center max-w-[210mm] mx-auto min-h-[297mm]">
    <div className="text-right font-bold text-xl mb-12 border-2 border-black inline-block px-4 float-right">BORANG C4</div>
    <div className="clear-both"></div>
    <h1 className="text-xl font-black underline mb-4">SENARAI PENERIMA RMT TAHUN {new Date().getFullYear()}</h1>
    <h2 className="text-lg font-bold mb-12">SEKOLAH : {SCHOOL_NAME}</h2>
    <table className="w-full border-collapse border-2 border-black text-sm">
      <thead><tr className="bg-gray-100 border-2 border-black font-bold">
        <th className="border-2 border-black p-3 w-16">BIL</th>
        <th className="border-2 border-black p-3 text-left px-6">NAMA MURID</th>
        <th className="border-2 border-black p-3 w-40">TAHUN / KELAS</th>
      </tr></thead>
      <tbody>{students.map((s, i) => (
        <tr key={s.id} className="border-2 border-black font-medium">
          <td className="border border-black p-3">{i+1}</td>
          <td className="border border-black p-3 text-left px-6">{s.name}</td>
          <td className="border border-black p-3">{s.className}</td>
        </tr>
      ))}</tbody>
    </table>
    <div className="mt-20 flex justify-between px-10">
       <div className="w-60 border-t border-black pt-2 font-bold text-[10px]">TANDATANGAN GURU BESAR / GPK HEM</div>
       <div className="w-60 border-t border-black pt-2 font-bold text-[10px]">CAP RASMI SEKOLAH</div>
    </div>
  </div>
);

const PrintContentC8 = ({ reports }) => (
  <div className="text-black uppercase text-[9px]">
     <div className="text-right font-bold text-xl mb-4 border-2 border-black inline-block px-4 float-right">BORANG C8</div>
     <div className="clear-both"></div>
     <h1 className="text-lg font-bold underline mb-8 text-center uppercase">LAPORAN HARIAN RMT (BORANG C8)</h1>
     <table className="w-full border-collapse border border-black text-center">
        <thead><tr className="bg-gray-100 border border-black font-bold">
          <th className="border border-black p-2 w-10">BIL</th>
          <th className="border border-black p-2 w-32">TARIKH / HARI</th>
          <th className="border border-black p-2">GURU BERTUGAS</th>
          <th className="border border-black p-2 w-40 text-left px-3">KRITERIA (1-4)</th>
          <th className="border border-black p-2">ULASAN / CATATAN</th>
        </tr></thead>
        <tbody>{reports.map((r, i) => (
          <tr key={r.id}>
            <td className="border border-black p-2">{i+1}</td>
            <td className="border border-black p-2">{r.date}<br/>({r.dayName})</td>
            <td className="border border-black p-2">{r.teacher}</td>
            <td className="border border-black p-2 text-left px-3 leading-tight">
               MENU: {r.scoreMenu} | RASA: {r.scoreTaste}<br/>BERSIH: {r.scoreHygiene} | ADAB: {r.scoreDiscipline}
            </td>
            <td className="border border-black p-2 italic">{r.notes}</td>
          </tr>
        ))}</tbody>
     </table>
  </div>
);

const PrintContentC7 = ({ reports }) => (
  <div className="text-black uppercase text-xs space-y-12">
    {reports.map(r => (
      <div key={r.id} className="border-4 border-black p-10 min-h-[297mm] relative page-break-after">
        <div className="text-right font-bold text-xl border-2 border-black inline-block px-4 float-right">BORANG C7</div>
        <div className="clear-both"></div>
        <h1 className="text-lg font-black underline mb-10 text-center">LAPORAN PEMANTAUAN PENTADBIR (RMT)</h1>
        <div className="grid grid-cols-2 gap-4 mb-8 font-bold">
           <div>TARIKH: {r.date}</div>
           <div>PEMANTU: {r.admin}</div>
           <div className="col-span-2">GURU BERTUGAS: {r.teacher}</div>
        </div>
        <div className="border border-black p-6 italic min-h-[150px] mb-20">ULASAN: {r.comments}</div>
        <div className="flex justify-between mt-20">
           <div className="w-60 border-t border-black pt-2 text-center">TANDATANGAN PEMANTAU</div>
           <div className="w-60 border-t border-black pt-2 text-center">CAP DAN TARIKH</div>
        </div>
      </div>
    ))}
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1 leading-none">{label}</label>
    <input 
      {...props} 
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 transition-all text-[11px] font-bold shadow-inner uppercase" 
    />
  </div>
);