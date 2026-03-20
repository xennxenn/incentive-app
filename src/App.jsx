import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, Users, DollarSign, FileText, Plus, Trash2, Edit2, 
  ChevronDown, CheckSquare, Square, Printer, Save, RefreshCw, X, FolderPlus,
  AlertCircle, CheckCircle, Cloud, Loader2, ArrowUp, ArrowDown, Lock, LogOut, UserPlus, Shield,
  BarChart3, PieChart, UserCog, CalendarDays, Database, FileSpreadsheet, AlertTriangle, Clock, UserMinus, Pencil, Ruler, MapPin, Key, Palette, Search
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  setDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  query,
  where
} from "firebase/firestore";

// ------------------------------------------------------------------
// 🚀 DEPLOYMENT CONFIGURATION (v6)
// ------------------------------------------------------------------
let app;
let auth;
let db;
let firebaseError = null;

// 1. Hardcoded Config (บังคับใช้ Firebase ของโปรเจกต์ incentive-employ เสมอ)
const manualConfig = {
  apiKey: "AIzaSyCRtYrko1XhpTTCRecRqKduASdSdimi64M",
  authDomain: "incentive-employ.firebaseapp.com",
  projectId: "incentive-employ",
  storageBucket: "incentive-employ.firebasestorage.app",
  messagingSenderId: "938778171328",
  appId: "1:938778171328:web:5f58ddff86442240321a25",
  measurementId: "G-7604ZB6EJF"
};

try {
  // ไม่ใช้ __firebase_config เพื่อป้องกันการหลุดไปใช้ DB ของ Canvas ซึ่งมี Rules ที่เข้มงวดเกินไป
  app = initializeApp(manualConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  if (!/already exists/.test(error.message)) { 
      firebaseError = `Connection Error: ${error.message}`; 
      console.error(firebaseError);
  }
}

// 2. Static APP ID (ระบุชื่อตรงๆ เพื่อป้องกันปัญหาเครื่องหมาย / ที่ทำให้ Firestore Error)
const appId = 'pasaya-incentive-v6-production';

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error(error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-600">Something went wrong. Please reload.</div>;
    return this.props.children;
  }
}

// --- Constants ---
const DEFAULT_SUPER_ADMIN = { username: 'T58121', password: '1234', name: 'Admin T58121', role: 'super_admin' };
const DEFAULT_TEAMS_DATA = [
  { name: 'ทีมช่างนาย', members: [{id: 'm1', name: 'ช่างนาย', joinDate: '2024-01-01'}, {id: 'm2', name: 'ช่างอาท', joinDate: '2024-01-01'}, {id: 'm3', name: 'ช่างลิด', joinDate: '2024-01-01'}] },
  { name: 'ทีมช่างเบนซ์', members: [{id: 'm4', name: 'ช่างเบนซ์', joinDate: '2024-01-01'}, {id: 'm5', name: 'ช่างกี้', joinDate: '2024-01-01'}] },
  { name: 'ทีมช่างอั้ม', members: [{id: 'm6', name: 'ช่างอั้ม', joinDate: '2024-01-01'}, {id: 'm7', name: 'ช่างต้อม', joinDate: '2024-01-01'}, {id: 'm8', name: 'ช่างทัด', joinDate: '2024-01-01'}] },
  { name: 'ทีมตัววิ่ง', members: [{id: 'm9', name: 'ช่างเวียร์', joinDate: '2024-01-01'}] },
  { name: 'ทีมวัดพื้นที่', members: [] },
];
const JOB_TYPES = [
  { id: 'measure', label: 'วัดพื้นที่' }, { id: 'travel_go', label: 'วันเดินทางไป' }, { id: 'travel_back', label: 'วันเดินทางกลับ' }, { id: 'install', label: 'ติดตั้ง' }, { id: 'install_high', label: 'ติดตั้ง/บันไดสูง' }, { id: 'install_scaffold', label: 'ติดตั้ง/นั่งร้าน' }, { id: 'fix', label: 'แก้ไข' }, { id: 'fix_scaffold', label: 'แก้ไข/นั่งร้าน' }, { id: 'fix_free', label: 'แก้ไขซ้ำ/ไม่คิด' },
];
const LEAVE_TYPES = [
    { id: 'sick', label: 'ลาป่วย', short: 'ป', color: 'bg-red-100 text-red-700' }, 
    { id: 'business', label: 'ลากิจ', short: 'ก', color: 'bg-yellow-100 text-yellow-700' }, 
    { id: 'vacation', label: 'พักร้อน', short: 'พ', color: 'bg-green-100 text-green-700' }, 
    { id: 'absent', label: 'ขาดงาน', short: 'ข', color: 'bg-gray-200 text-gray-700' },
];
const TIME_SLOTS = [ "10.00 - 11.30", "10.00 - 14.30", "10.00 - 17.00", "13.00 - 14.30", "13.00 - 17.00", "15.30 - 17.00" ];
const DEFAULT_TIME_SLOT = "10.00 - 11.30";

// --- Helpers ---
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) { return dateStr; }
};
const getDaysArray = (start, end) => {
  const arr = [];
  try {
    const dt = new Date(start); const endDate = new Date(end);
    if (isNaN(dt.getTime()) || isNaN(endDate.getTime())) return [];
    while (dt <= endDate) {
        const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, '0'); const d = String(dt.getDate()).padStart(2, '0');
        arr.push(`${y}-${m}-${d}`); dt.setDate(dt.getDate() + 1);
    }
  } catch (e) { }
  return arr;
};
const getCurrentMonthPeriod = () => {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    const start = new Date(y, m, 1); const end = new Date(y, m + 1, 0);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { name: 'เดือนปัจจุบัน', start: fmt(start), end: fmt(end) };
};

export default function App() {
  // --- State ---
  const [dbReady, setDbReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false); 
  
  const [teams, setTeams] = useState([]);
  const [holidays, setHolidays] = useState([]); 
  const [leaves, setLeaves] = useState([]); 
  const [jobs, setJobs] = useState([]);
  const [savedPeriods, setSavedPeriods] = useState([]);
  const [appUsers, setAppUsers] = useState([]); 
  const [themeColor, setThemeColor] = useState('#424242'); // Updated Default Theme

  const [period, setPeriod] = useState(() => {
      try { const saved = localStorage.getItem(`pasaya_period_${appId}`); return saved ? JSON.parse(saved) : getCurrentMonthPeriod(); } catch (e) { return getCurrentMonthPeriod(); }
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportType, setReportType] = useState('team'); 
  const [selectedReportTeamId, setSelectedReportTeamId] = useState('');
  const [selectedReportTechId, setSelectedReportTechId] = useState('');
  
  // Login Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // UI State
  const [newTeamName, setNewTeamName] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [addingMemberTo, setAddingMemberTo] = useState(null); 
  const [newMember, setNewMember] = useState({ name: '', joinDate: '', resignDate: '' }); 
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'admin' });
  const [newPeriodName, setNewPeriodName] = useState('');
  const [notification, setNotification] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);
  
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobDate, setNewJobDate] = useState('');
  const [newJobTimeSlot, setNewJobTimeSlot] = useState(DEFAULT_TIME_SLOT);

  const [activeLeaveCell, setActiveLeaveCell] = useState(null); 
  const [editingMember, setEditingMember] = useState(null); 
  const [editingPeriod, setEditingPeriod] = useState(null); 
  
  const leaveMenuRef = useRef(null);

  // --- Handlers ---
  const showNotification = (message, type = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 4000); };
  const requestConfirm = (title, message, onConfirm) => { setConfirmModal({ title, message, onConfirm }); };

  const handlePermissionError = (err) => {
      console.error("Firebase Permission Error:", err);
      if (err && err.message && (err.message.includes("Missing or insufficient permissions") || err.code === 'permission-denied')) {
          setPermissionError(true);
      }
  };

  const openLeaveMenu = (e, techId, date) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveLeaveCell({ techId, date, top: rect.bottom + window.scrollY, left: Math.min(rect.left + window.scrollX, window.innerWidth - 150) });
  };

  const selectLeaveType = async (type) => {
      if (!activeLeaveCell) return;
      const { techId, date } = activeLeaveCell;
      const existing = leaves.find(l => l.techId === techId && l.date === date);
      try {
          if (type === 'clear') { if (existing) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaves', existing.id)); } 
          else { 
              if (existing) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaves', existing.id), { type }); 
              else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leaves'), { techId, date, type }); 
              const jobsOnDate = jobs.filter(j => j.date === date);
              let removedCount = 0;
              for (const job of jobsOnDate) {
                  if ((job.selectedTechs || []).includes(techId)) {
                      const newSelection = job.selectedTechs.filter(id => id !== techId);
                      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id), { selectedTechs: newSelection });
                      removedCount++;
                  }
              }
              if (removedCount > 0) showNotification(`บันทึกวันลาและนำชื่อออกจาก ${removedCount} งานในวันนี้แล้ว`, 'warning');
              else showNotification('บันทึกวันลาสำเร็จ');
          }
      } catch (err) { handlePermissionError(err); showNotification(`Error: ${err.message}`, 'error'); }
      setActiveLeaveCell(null);
  };

  const handleAddHoliday = async (d) => {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'holidays', d);
      try { if(holidays.includes(d)) await deleteDoc(ref); else await setDoc(ref, { date: d }); } 
      catch (err) { handlePermissionError(err); showNotification(`Error: ${err.message}`, 'error'); }
  };

  // --- Dynamic Favicon Effect ---
  useEffect(() => {
    const setFavicon = (url) => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = url;
    };
    const logoUrl = 'https://drive.google.com/uc?export=view&id=1xT2ysUSWkTcFxs1ztoGxZuQcnO_c66Tu';
    setFavicon(logoUrl);
  }, []);

  // --- Auth & Init Effects ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => { 
        try {
            // บังคับล็อกอินแบบ Anonymous ตรงเข้า Database ของ User เลย
            await signInAnonymously(auth); 
        } catch (err) { 
            console.error("Auth Error", err);
        }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
        if (u) {
            setDbReady(true); 
            setPermissionError(false); // Reset error state on connection
        }
    });
    return () => unsubscribe();
  }, []);

  // --- Fetch Data ---
  useEffect(() => {
    if (!dbReady || !db) return;
    try {
        const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'app_users'), (snap) => setAppUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handlePermissionError);
        const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'theme'), (docSnap) => { if(docSnap.exists() && docSnap.data().color) setThemeColor(docSnap.data().color); }, handlePermissionError);
        return () => { unsubUsers(); unsubSettings(); };
    } catch (e) {
        console.error("Initialization query error:", e);
    }
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady || !currentUser || !db) { setLoading(false); return; }
    try {
        const unsubTeams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), async (snap) => {
              const list = snap.docs.map(d => ({ id: d.id, ...d.data() })); setTeams(list);
              if (list.length === 0 && !snap.metadata.fromCache) {
                 try {
                     const check = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'teams'));
                     if (check.empty) { 
                         DEFAULT_TEAMS_DATA.forEach(async (t) => await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), t)); 
                     }
                 } catch(e) {}
              }
        }, handlePermissionError);

        const unsubJobs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), (s) => setJobs(s.docs.map(d => ({ id: d.id, ...d.data() }))), handlePermissionError);
        const unsubLeaves = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'leaves'), (s) => setLeaves(s.docs.map(d => ({ id: d.id, ...d.data() }))), handlePermissionError);
        const unsubHols = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'holidays'), (s) => setHolidays(s.docs.map(d => d.data().date)), handlePermissionError);
        const unsubPeriods = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'savedPeriods'), (s) => { setSavedPeriods(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, handlePermissionError);
        
        return () => { unsubTeams(); unsubJobs(); unsubLeaves(); unsubHols(); unsubPeriods(); };
    } catch (e) {
        console.error("Data query error:", e);
    }
  }, [dbReady, currentUser]);

  useEffect(() => { localStorage.setItem(`pasaya_period_${appId}`, JSON.stringify(period)); }, [period]);
  
  useEffect(() => {
      const storedUser = localStorage.getItem('pasaya_app_user');
      if (storedUser) { try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {} }
  }, []);

  // Protect Admin Tab
  useEffect(() => {
      if (activeTab === 'admin' && currentUser?.role !== 'super_admin') setActiveTab('dashboard');
  }, [activeTab, currentUser]);

  useEffect(() => { function handleClickOutside(event) { if (leaveMenuRef.current && !leaveMenuRef.current.contains(event.target)) setActiveLeaveCell(null); } document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [leaveMenuRef]);

  // --- Theme Change Handler ---
  const handleSaveTheme = async (color) => {
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'theme'), { color });
          showNotification('เปลี่ยนสีธีมสำเร็จ');
      } catch (err) { handlePermissionError(err); showNotification(`Error: ${err.message}`, 'error'); }
  };

  // --- Login & Logout ---
  const handleLogin = async (e) => {
      e.preventDefault();
      const inputUser = usernameInput.trim();
      const inputPass = passwordInput.trim();
      
      if (inputUser === DEFAULT_SUPER_ADMIN.username && inputPass === DEFAULT_SUPER_ADMIN.password) {
           const adminData = { username: inputUser, role: 'super_admin', name: 'Admin T58121' };
           setCurrentUser(adminData);
           localStorage.setItem('pasaya_app_user', JSON.stringify(adminData));
           showNotification(`ยินดีต้อนรับ ${adminData.name}`);
           setUsernameInput(''); setPasswordInput('');
           if (db) {
               try {
                   const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'app_users'), where("username", "==", DEFAULT_SUPER_ADMIN.username));
                   getDocs(q).then((snap) => { if (snap.empty) addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'app_users'), DEFAULT_SUPER_ADMIN); });
               } catch (err) {}
           }
           return;
      }

      const dbUser = appUsers.find(u => u.username === inputUser && u.password === inputPass);
      if (dbUser) {
          const userData = { username: dbUser.username, role: dbUser.role, name: dbUser.name || dbUser.username };
          setCurrentUser(userData);
          localStorage.setItem('pasaya_app_user', JSON.stringify(userData));
          showNotification(`ยินดีต้อนรับ ${userData.name}`);
          setUsernameInput(''); setPasswordInput('');
      } else { showNotification('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error'); }
  };

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('pasaya_app_user'); };

  // --- CRUD Operations ---
  const handleAddAppUser = async () => {
      if (!newUser.username || !newUser.password) { showNotification('กรุณากรอก Username/Password', 'error'); return; }
      if (appUsers.some(u => u.username === newUser.username)) { showNotification('Username ซ้ำ', 'error'); return; }
      try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'app_users'), newUser);
          setNewUser({ username: '', password: '', name: '', role: 'admin' });
          showNotification('เพิ่มผู้ใช้งานสำเร็จ');
      } catch (e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  };

  const handleRemoveAppUser = (id, username) => {
      if (username === DEFAULT_SUPER_ADMIN.username || username === currentUser.username) return;
      requestConfirm('ลบผู้ใช้งาน', `ยืนยันลบ ${username}?`, async () => {
          try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_users', id)); setConfirmModal(null); showNotification('ลบผู้ใช้งานสำเร็จ'); } 
          catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      });
  };

  const handleSeedData = async () => { 
      requestConfirm('กู้คืนข้อมูล', 'ยืนยัน?', async () => { 
          try {
              const batch = writeBatch(db); 
              teams.forEach(t => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'teams', t.id))); 
              await batch.commit(); 
              for (const t of DEFAULT_TEAMS_DATA) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), t); 
              setConfirmModal(null); showNotification('กู้คืนข้อมูลสำเร็จ');
          } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      }); 
  };

  const handleAddTeam = async () => { 
      if(!newTeamName) return;
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), { name: newTeamName, members: [] }); setIsAddingTeam(false); showNotification('เพิ่มทีมสำเร็จ'); } 
      catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  };

  const handleDeleteTeam = (id) => requestConfirm('ลบทีม', 'ยืนยัน?', async () => { 
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', id)); setConfirmModal(null); } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  });

  const handleAddMember = async (tid) => { 
      const t = teams.find(x => x.id === tid); 
      if(t && newMember.name) { 
          try {
              const upd = [...(t.members||[]), { id: `m${Date.now()}`, ...newMember }]; 
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', tid), { members: upd }); 
              setAddingMemberTo(null); setNewMember({ name: '', joinDate: '', resignDate: '' }); showNotification('เพิ่มสมาชิกสำเร็จ');
          } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      } 
  };
  
  const handleUpdateMember = async () => {
      if (!editingMember) return;
      const { teamId, memberId, data } = editingMember;
      const team = teams.find(t => t.id === teamId);
      if (team) {
          try {
              const updatedMembers = team.members.map(m => m.id === memberId ? { ...m, ...data } : m);
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', teamId), { members: updatedMembers });
              setEditingMember(null); showNotification('อัปเดตข้อมูลสำเร็จ');
          } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      }
  };
  
  const handleDeleteMember = (tid, mid) => requestConfirm('ลบสมาชิก', 'ยืนยัน?', async () => { 
      const t = teams.find(x => x.id === tid); 
      try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', tid), { members: t.members.filter(m => m.id !== mid) }); setConfirmModal(null); showNotification('ลบสมาชิกสำเร็จ'); } 
      catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  });
  
  const initiateAddJob = () => { 
      const today = new Date().toISOString().split('T')[0]; 
      setNewJobDate((today >= period.start && today <= period.end) ? today : period.start); 
      setNewJobTimeSlot(DEFAULT_TIME_SLOT); setShowAddJobModal(true); 
  };
  
  const confirmAddJob = async () => { 
      if (!newJobDate) return; 
      try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), { 
              date: newJobDate, customer: '', location: '', orderNo: '', timeSlot: newJobTimeSlot, type: 'install', rails: 0, selectedTechs: [], createdAt: new Date().toISOString(), orderIndex: Date.now() 
          }); 
          setShowAddJobModal(false); showNotification('เพิ่มงานสำเร็จ');
      } catch(e) { handlePermissionError(e); showNotification(`Error adding job: ${e.message}`, 'error'); }
  };

  const updateJob = async (id, f, v) => { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id), { [f]: v }); } catch(e) { handlePermissionError(e); showNotification(`Update failed: ${e.message}`, 'error'); } };
  const removeJob = async (id) => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', id)); } catch(e) { handlePermissionError(e); showNotification(`Delete failed: ${e.message}`, 'error'); } };
  const moveJob = async (id, dir, list) => { 
      const idx = list.findIndex(j => j.id === id); if(idx === -1 || idx+dir < 0 || idx+dir >= list.length) return; 
      const j1 = list[idx], j2 = list[idx+dir]; let o1 = j1.orderIndex || Date.now(), o2 = j2.orderIndex || (Date.now()-1000); if(o1 === o2) o1 += 1; 
      try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', j1.id), { orderIndex: o2 }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'jobs', j2.id), { orderIndex: o1 }); } 
      catch(e) { handlePermissionError(e); showNotification(`Move failed: ${e.message}`, 'error'); }
  };
  const toggleTech = async (jid, tid) => { const j = jobs.find(x => x.id === jid); const sel = j.selectedTechs || []; try { await updateJob(jid, 'selectedTechs', sel.includes(tid) ? sel.filter(x => x!==tid) : [...sel, tid]); } catch(e) { handlePermissionError(e); showNotification(`Toggle failed: ${e.message}`, 'error'); } };
  const handleSavePeriod = async () => { if(newPeriodName) { try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'savedPeriods'), { ...period, name: newPeriodName }); setNewPeriodName(''); setShowPeriodManager(false); showNotification('บันทึกรอบสำเร็จ'); } catch(e) { handlePermissionError(e); showNotification(`Save failed: ${e.message}`, 'error'); } } };
  
  const handleDeletePeriod = (id) => {
      setShowPeriodManager(false); // ซ่อนเมนู dropdown ก่อนแสดงหน้าจอยืนยัน
      requestConfirm('ลบรอบบันทึก', 'ยืนยันการลบช่วงเวลานี้?', async () => { 
          try { 
              await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savedPeriods', id)); 
              setConfirmModal(null); 
              showNotification('ลบรอบบันทึกสำเร็จ');
          } catch(e) { 
              handlePermissionError(e); 
              showNotification(`Delete failed: ${e.message}`, 'error'); 
          } 
      });
  };

  const handleUpdatePeriod = async () => { if (!editingPeriod || !editingPeriod.name) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savedPeriods', editingPeriod.id), { name: editingPeriod.name, start: editingPeriod.start, end: editingPeriod.end }); setEditingPeriod(null); showNotification('อัปเดตรอบสำเร็จ'); } catch(e) { handlePermissionError(e); showNotification(`Update failed: ${e.message}`, 'error'); } };

  // --- CALCULATION & REPORTS LOGIC ---
  const calculatedData = useMemo(() => {
    try {
        const periodJobs = jobs.filter(j => j.date >= period.start && j.date <= period.end);
        
        // Sorting Jobs: Newest Date First, Then Earliest Time First
        periodJobs.sort((a, b) => {
            const dateDiff = b.date.localeCompare(a.date);
            if (dateDiff !== 0) return dateDiff;
            return (a.timeSlot || '').localeCompare(b.timeSlot || '');
        });
        
        const dailyTeamIncentive = {}; 
        let totalIncentive = 0; let totalRails = 0; let totalMeasureJobs = 0;

        periodJobs.forEach(job => {
            let val = 0; const cnt = (job.selectedTechs || []).length; const rails = parseInt(job.rails) || 0;
            const excludedTypes = ['measure', 'travel_go', 'travel_back', 'fix_free'];
            
            if (!excludedTypes.includes(job.type)) totalRails += rails;
            if (job.type === 'measure') totalMeasureJobs += 1;

            if (cnt > 0) {
                if (job.type === 'measure') val = 250 * cnt;
                else if (['travel_go', 'travel_back', 'fix_free'].includes(job.type)) val = 0;
                else val = (250 * cnt) + (rails > 10 ? (rails - 10) * 20 : 0);
            }
            job.calculatedValue = val; 
            totalIncentive += val;

            if (cnt > 0) {
                const teamsInvolved = {}; let totalTechsInJob = 0;
                (job.selectedTechs || []).forEach(tid => {
                    const t = teams.find(x => (x.members||[]).some(m => m.id === tid));
                    if (t) { teamsInvolved[t.id] = (teamsInvolved[t.id] || 0) + 1; totalTechsInJob++; }
                });
                
                const date = job.date;
                if (!dailyTeamIncentive[date]) dailyTeamIncentive[date] = {};

                Object.keys(teamsInvolved).forEach(teamId => {
                    const teamTechCount = teamsInvolved[teamId];
                    const teamShare = (val * teamTechCount) / totalTechsInJob;
                    
                    if (!dailyTeamIncentive[date][teamId]) dailyTeamIncentive[date][teamId] = { amount: 0, rails: 0, measures: 0 };
                    dailyTeamIncentive[date][teamId].amount += teamShare;

                    const totalTeams = Object.keys(teamsInvolved).length;
                    if (!excludedTypes.includes(job.type)) dailyTeamIncentive[date][teamId].rails += (rails / totalTeams);
                    if (job.type === 'measure') dailyTeamIncentive[date][teamId].measures += 1; 
                });
            }
        });

        const daysInPeriod = getDaysArray(period.start, period.end);
        const periodWorkingDays = daysInPeriod.filter(d => !holidays.includes(d)).length;
        
        // --- Daily Logs Generation (For Reports Tab) ---
        const reportTeamLogs = {};
        const reportTechLogs = {};
        teams.forEach(t => {
            reportTeamLogs[t.id] = { name: t.name, rows: [] };
            (t.members || []).forEach(m => {
                reportTechLogs[m.id] = { name: m.name, teamName: t.name, rows: [] };
            });
        });

        const teamStats = teams.map(team => {
            const membersList = team.members || [];
            const memberEarnings = {}; const memberLeavesList = {};
            membersList.forEach(m => { memberEarnings[m.id] = 0; memberLeavesList[m.id] = []; });
            let teamTotalEarned = 0; let teamTotalRails = 0; let teamTotalMeasures = 0;
            
            daysInPeriod.forEach(day => {
                const dayStats = dailyTeamIncentive[day]?.[team.id];
                const isHol = holidays.includes(day);

                // Add Holiday Logs
                if (isHol) {
                    reportTeamLogs[team.id].rows.push({ isHoliday: true, date: day, time: '-', type: '-', customer: 'วันหยุดบริษัท', location: '-', rails: '-', techs: '-', note: '-', inc: '-' });
                    membersList.forEach(m => {
                        reportTechLogs[m.id].rows.push({ isHoliday: true, date: day, time: '-', type: '-', customer: 'วันหยุดบริษัท', location: '-', rails: '-', techs: '-', note: '-', inc: '-' });
                    });
                } else {
                    // Add Leave Logs
                    membersList.forEach(m => {
                        const leave = leaves.find(l => l.techId === m.id && l.date === day);
                        if (leave) {
                            memberLeavesList[m.id].push({ date: day, type: leave.type });
                            const lName = LEAVE_TYPES.find(x => x.id === leave.type)?.label || 'ลา';
                            reportTechLogs[m.id].rows.push({ isLeave: true, date: day, time: '-', type: '-', customer: `ลา (${lName})`, location: '-', rails: '-', techs: '-', note: '-', inc: '-' });
                        }
                    });
                }

                // Process Job Logs for this day (Ascending order for report)
                const dayJobs = periodJobs.filter(j => j.date === day).sort((a,b) => (a.timeSlot||'').localeCompare(b.timeSlot||''));
                
                dayJobs.forEach(job => {
                    const involvedTeams = {};
                    const techIds = job.selectedTechs || [];
                    const totalTechsInJob = techIds.length;
                    
                    techIds.forEach(tid => {
                        const tMatch = teams.find(x => (x.members||[]).some(m => m.id === tid));
                        if (tMatch) {
                            if (!involvedTeams[tMatch.id]) involvedTeams[tMatch.id] = [];
                            involvedTeams[tMatch.id].push(tid);
                        }
                    });

                    const totalTeams = Object.keys(involvedTeams).length;
                    const isShared = totalTeams > 1;
                    const excludedTypes = ['measure', 'travel_go', 'travel_back', 'fix_free'];
                    const isExcluded = excludedTypes.includes(job.type);
                    
                    // If this team is involved in this job
                    if (involvedTeams[team.id]) {
                        const teamTechs = involvedTeams[team.id];
                        const teamTechCount = teamTechs.length;
                        const jobVal = job.calculatedValue || 0;
                        const jobRails = parseInt(job.rails) || 0;
                        
                        const teamShareAmt = totalTechsInJob > 0 ? (jobVal * teamTechCount) / totalTechsInJob : 0;
                        const teamRailsShare = isExcluded ? 0 : (jobRails / totalTeams);
                        
                        const typeLabel = JOB_TYPES.find(t=>t.id===job.type)?.label || job.type;
                        const noteStr = isShared ? 'งานควบ' : '';

                        // Push Team Row
                        reportTeamLogs[team.id].rows.push({
                            date: job.date,
                            time: job.timeSlot || '-',
                            type: typeLabel,
                            customer: job.customer || '-',
                            location: job.location || '-',
                            rails: isExcluded ? '-' : Number(teamRailsShare.toFixed(2)),
                            techs: teamTechCount,
                            note: noteStr,
                            inc: teamShareAmt
                        });

                        // Calculate eligible for individuals
                        const activeMembers = membersList.filter(m => m.joinDate <= day && (!m.resignDate || m.resignDate > day));
                        const eligibleMembers = activeMembers.filter(m => {
                            const leave = leaves.find(l => l.techId === m.id && l.date === day);
                            return !leave || leave.type === 'vacation';
                        });
                        
                        const sharePerHead = eligibleMembers.length > 0 ? teamShareAmt / eligibleMembers.length : 0;
                        const railsPerHead = teamTechCount > 0 ? teamRailsShare / teamTechCount : 0;

                        teamTechs.forEach(tid => {
                            const isEligible = eligibleMembers.some(em => em.id === tid);
                            reportTechLogs[tid].rows.push({
                                date: job.date,
                                time: job.timeSlot || '-',
                                type: typeLabel,
                                customer: job.customer || '-',
                                location: job.location || '-',
                                rails: isExcluded ? '-' : Number(railsPerHead.toFixed(2)),
                                techs: teamTechCount,
                                note: noteStr,
                                inc: isEligible ? sharePerHead : 0
                            });
                        });
                    }
                });

                if (dayStats) { teamTotalRails += dayStats.rails; teamTotalMeasures += dayStats.measures; }
                if (isHol) return;

                const dailyPot = dayStats?.amount || 0;
                const activeMembers = membersList.filter(m => m.joinDate <= day && (!m.resignDate || m.resignDate > day));
                const eligibleMembers = activeMembers.filter(m => {
                    const leave = leaves.find(l => l.techId === m.id && l.date === day);
                    return !leave || leave.type === 'vacation';
                });
                
                const sharePerHead = eligibleMembers.length > 0 ? dailyPot / eligibleMembers.length : 0;
                if (dailyPot > 0) teamTotalEarned += dailyPot;
                activeMembers.forEach(m => { if (eligibleMembers.some(em => em.id === m.id)) memberEarnings[m.id] += sharePerHead; });
            });

            return { 
                ...team, 
                totalEarned: teamTotalEarned, totalRails: teamTotalRails, totalMeasures: teamTotalMeasures,
                members: membersList.map(m => ({ 
                    ...m, 
                    incentive: memberEarnings[m.id],
                    workDays: daysInPeriod.filter(d => !holidays.includes(d) && m.joinDate <= d && (!m.resignDate || m.resignDate > d) && !leaves.find(l => l.techId === m.id && l.date === d)).length,
                    leaves: memberLeavesList[m.id]
                })) 
            };
        });
        
        const individualStats = teamStats.flatMap(t => (t.members || []).map(m => ({...m, teamName: t.name}))).sort((a,b) => b.incentive - a.incentive);
        const totalTechs = teamStats.reduce((acc, t) => acc + (t.members || []).length, 0);

        return { periodJobs, totalIncentive, teamStats, individualStats, totalTechs, periodWorkingDays, totalRails, totalMeasureJobs, reportTeamLogs, reportTechLogs };
    } catch (e) { 
        console.error("Calc Error", e);
        return { periodJobs: [], totalIncentive: 0, teamStats: [], individualStats: [], totalTechs: 0, periodWorkingDays: 0, totalRails: 0, totalMeasureJobs: 0, reportTeamLogs: {}, reportTechLogs: {} }; 
    }
  }, [jobs, teams, holidays, leaves, period]);

  const exportToCSV = () => {
      const headers = ["วันที่", "ลูกค้า", "สถานที่", "Order No", "เวลา", "ประเภทงาน", "จำนวนราง", "ทีมช่าง", "รายชื่อช่าง", "ค่า Incentive"];
      const rows = calculatedData.periodJobs.map(j => {
          const tNames = teams.flatMap(t => t.members || []).filter(m => (j.selectedTechs || []).includes(m.id)).map(m => m.name).join(", ");
          return [j.date, `"${(j.customer||'').replace(/"/g,'""')}"`, `"${(j.location||'').replace(/"/g,'""')}"`, `"${(j.orderNo||'').replace(/"/g,'""')}"`, j.timeSlot || `${j.timeIn || ''} - ${j.timeOut || ''}`, JOB_TYPES.find(t => t.id === j.type)?.label || j.type, j.rails, `"${tNames}"`, j.calculatedValue].join(",");
      });
      const blob = new Blob(["\uFEFF" + [headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `report.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- TABS DEFINITION ---
  const TABS = [
      {id: 'dashboard', icon: BarChart3, label: 'ภาพรวม'},
      {id: 'jobs', icon: FileText, label: 'บันทึกงาน'},
      {id: 'teams', icon: Users, label: 'ทีมช่าง'},
      {id: 'calendar', icon: Calendar, label: 'ปฏิทิน'},
      {id: 'reports', icon: FileSpreadsheet, label: 'รายงาน'},
  ];
  if (currentUser?.role === 'super_admin') {
      TABS.push({id: 'admin', icon: Shield, label: 'ผู้ดูแล'});
  }

  // --- RENDER ---
  if (!currentUser) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
           {notification && <div className="fixed top-4 bg-red-500 text-white px-4 py-2 rounded shadow">{notification.message}</div>}
           <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
               <div className="mb-6 flex justify-center"><div className="w-32 h-32 border-4 border-black flex items-center justify-center p-2 bg-white"><div className="text-center"><h1 className="text-2xl font-serif font-bold tracking-widest leading-none">PASAYA</h1><p className="text-[8px] tracking-[0.2em] font-sans font-bold mt-1">CURTAIN CENTER</p></div></div></div>
               <h2 className="text-xl font-bold text-gray-800 mb-6">Incentive Calculator</h2>
               <form onSubmit={handleLogin} className="space-y-4 text-left">
                   <div><label className="text-xs font-bold text-gray-600 block mb-1">Username</label><div className="relative"><input type="text" required className="w-full border rounded-lg px-4 py-2 pl-10" value={usernameInput} onChange={e => setUsernameInput(e.target.value)}/><Users className="absolute left-3 top-2.5 text-gray-400" size={16}/></div></div>
                   <div><label className="text-xs font-bold text-gray-600 block mb-1">Password</label><div className="relative"><input type="password" required className="w-full border rounded-lg px-4 py-2 pl-10" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}/><Key className="absolute left-3 top-2.5 text-gray-400" size={16}/></div></div>
                   <button type="submit" style={{backgroundColor: themeColor}} className="w-full text-white font-bold py-2 rounded-lg hover:opacity-90 flex items-center justify-center gap-2">เข้าสู่ระบบ <ArrowUp className="rotate-90" size={16}/></button>
               </form>
           </div>
           {permissionError && (
               <div className="mt-8 bg-red-50 text-red-600 text-xs p-4 rounded-xl border border-red-200 max-w-md">
                   <p className="font-bold flex items-center gap-1"><AlertTriangle size={14}/> ไม่สามารถเชื่อมต่อ Database</p>
                   <p className="mt-1">โปรดตรวจสอบว่าเปิดใช้งาน <b>Anonymous</b> ในส่วน Authentication ของ Firebase Console หรือยัง</p>
               </div>
           )}
      </div>
  );

  const printStyles = `@media print { @page { size: A4; margin: 1cm; } body, html, #root { background: white !important; height: auto !important; overflow: visible !important; } .no-print { display: none !important; } .print-only { display: block !important; position: relative; top: 0; left: 0; width: 100%; } table { width: 100% !important; border-collapse: collapse !important; } th, td { border: 1px solid black !important; padding: 6px !important; } .print-visible { display: block !important; } .print-only-table table { border: 1px solid black; } } .print-only { display: none; }`;

  return (
    <div className="min-h-screen bg-white text-sm font-sans text-gray-800 pb-20 relative">
      <style>{printStyles}</style>
      {notification && <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 animate-bounce-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'} no-print`}>{notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}<span>{notification.message}</span></div>}
      {permissionError && (
          <div className="fixed bottom-4 left-4 z-[2000] max-w-md bg-red-50 border border-red-200 shadow-2xl rounded-xl p-4 flex flex-col gap-3 no-print">
               <div><h3 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={16}/> เชื่อมต่อ Database ไม่ได้</h3><p className="text-xs text-red-600 mt-1">กรุณาตรวจสอบว่าตั้งค่า Firebase กฎ Rules ครบถ้วนและเปิด Anonymous Authentication แล้ว</p></div>
               <button onClick={() => setPermissionError(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs w-full">ปิดแจ้งเตือนนี้</button>
          </div>
      )}
      {confirmModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 no-print"><div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6"><h3 className="text-lg font-bold mb-2">{confirmModal.title}</h3><p className="text-gray-600 mb-6">{confirmModal.message}</p><div className="flex gap-3 justify-end"><button onClick={()=>setConfirmModal(null)} className="px-4 py-2 bg-gray-100 rounded-lg">ยกเลิก</button><button onClick={confirmModal.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg">ยืนยัน</button></div></div></div>}
      {showAddJobModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 no-print"><div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6"><h3 className="text-lg font-bold mb-4">เพิ่มงานใหม่</h3><div className="space-y-4"><div className="space-y-1"><label className="block text-xs font-bold text-gray-500">เลือกวันที่:</label><input type="date" className="w-full border rounded p-2 text-lg font-bold" value={newJobDate} onChange={e=>setNewJobDate(e.target.value)}/></div><div className="space-y-1"><label className="block text-xs font-bold text-gray-500">เลือกเวลา:</label><select className="w-full border rounded p-2 text-lg font-bold" value={newJobTimeSlot} onChange={e=>setNewJobTimeSlot(e.target.value)}>{TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}</select></div></div><div className="flex gap-3 justify-end mt-6"><button onClick={()=>setShowAddJobModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">ยกเลิก</button><button onClick={confirmAddJob} style={{backgroundColor: themeColor}} className="px-4 py-2 text-white rounded-lg hover:opacity-90">ตกลง</button></div></div></div>}
      {activeLeaveCell && (<div ref={leaveMenuRef} className="absolute bg-white shadow-xl border rounded-lg p-1 z-[999] min-w-[120px] no-print" style={{ top: activeLeaveCell.top, left: activeLeaveCell.left }}>{LEAVE_TYPES.map(type => (<button key={type.id} onClick={() => selectLeaveType(type.id)} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded flex items-center gap-2 ${type.color.replace('bg-', 'text-')}`}><span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${type.color}`}>{type.short}</span>{type.label}</button>))}<div className="h-px bg-gray-100 my-1"></div><button onClick={() => selectLeaveType('clear')} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded">ยกเลิกวันลา</button></div>)}

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-4">
             <div className="flex items-center gap-4"><div style={{borderColor: themeColor}} className="border-2 p-1 w-12 h-12 flex items-center justify-center"><div className="text-center" style={{color: themeColor}}><h1 className="text-[10px] font-serif font-bold tracking-widest leading-none">PASAYA</h1><p className="text-[4px] tracking-[0.1em] font-sans font-bold">CURTAIN</p></div></div><div className="h-8 w-px bg-gray-300"></div><div><h2 className="font-bold text-gray-700">Incentive Calculator</h2><div className="flex items-center gap-2 text-xs text-gray-500"><Users size={10}/> User: {currentUser.name} ({currentUser.role})</div></div></div>
             <div className="flex gap-2"><button onClick={() => window.print()} style={{backgroundColor: themeColor}} className="px-3 py-2 rounded-md flex items-center gap-2 text-white hover:opacity-90 text-xs"><Printer size={14} /> Print</button><button onClick={handleLogout} className="px-3 py-2 rounded-md flex items-center gap-2 border hover:bg-gray-50 text-red-600 text-xs"><LogOut size={14} /> Out</button></div>
          </div>
          <div className="flex flex-wrap items-end gap-4 justify-between pt-2">
            <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg border"><span className="text-[10px] uppercase font-bold text-gray-500 px-2">Period</span><div className="font-bold text-sm px-2 border-r border-gray-300" style={{color: themeColor}}>{period.name}</div><input type="date" value={period.start} onChange={e => setPeriod({...period, start: e.target.value, name: 'กำหนดเอง'})} className="bg-transparent border-none text-xs w-24"/><span className="text-gray-400">-</span><input type="date" value={period.end} onChange={e => setPeriod({...period, end: e.target.value, name: 'กำหนดเอง'})} className="bg-transparent border-none text-xs w-24"/><button onClick={() => setShowPeriodManager(!showPeriodManager)} className="p-1 hover:bg-white rounded"><FolderPlus size={14}/></button>{showPeriodManager && <div className="absolute top-full left-0 mt-2 w-72 bg-white border shadow-xl rounded-xl z-50 p-4"><h4 className="font-bold mb-2 text-gray-700">Saved Periods</h4><ul className="max-h-40 overflow-y-auto mb-3 space-y-1 text-xs">{savedPeriods.map((p, pIdx) => (<li key={`${p.id}-${pIdx}`} className="flex justify-between p-2 hover:bg-gray-50 cursor-pointer rounded">{editingPeriod?.id === p.id ? (<div className="flex gap-1 flex-1" onClick={e=>e.stopPropagation()}><input className="border rounded p-1 w-20" value={editingPeriod.name} onChange={e=>setEditingPeriod({...editingPeriod, name:e.target.value})}/><input type="date" className="border rounded p-1" value={editingPeriod.start} onChange={e=>setEditingPeriod({...editingPeriod, start:e.target.value})}/><input type="date" className="border rounded p-1" value={editingPeriod.end} onChange={e=>setEditingPeriod({...editingPeriod, end:e.target.value})}/><button onClick={handleUpdatePeriod} className="bg-green-500 text-white px-1 rounded">✓</button><button onClick={()=>setEditingPeriod(null)} className="bg-gray-300 px-1 rounded">x</button></div>) : (<><span onClick={() => {setPeriod(p); setShowPeriodManager(false);}} className="flex-1">{p.name}</span> <div className="flex gap-1"><button onClick={(e)=>{e.stopPropagation(); setEditingPeriod(p);}} className="text-gray-400 hover:text-blue-500"><Pencil size={12}/></button><button onClick={(e)=>{e.preventDefault(); e.stopPropagation(); handleDeletePeriod(p.id)}} className="text-gray-400 hover:text-red-500"><X size={12}/></button></div></>)}</li>))}</ul><div className="flex gap-1"><input className="border rounded px-2 py-1 text-xs flex-1" placeholder="ชื่อรอบ" value={newPeriodName} onChange={e=>setNewPeriodName(e.target.value)}/><button onClick={handleSavePeriod} style={{backgroundColor: themeColor}} className="text-white px-2 rounded text-xs hover:opacity-90">Save</button></div></div>}</div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === t.id ? 'shadow text-white' : 'text-gray-500 hover:text-gray-700'}`} style={activeTab === t.id ? {backgroundColor: themeColor} : {}}>
                        <t.icon size={12}/> {t.label}
                    </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - ปรับซ่อนเมื่อสั่งพิมพ์เฉพาะเมื่อไม่ได้อยู่แท็บ Reports */}
      <div className={`max-w-7xl mx-auto px-4 py-6 ${activeTab !== 'reports' ? 'no-print' : ''}`}>
        <ErrorBoundary>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
             <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div style={{backgroundColor: themeColor}} className="text-white p-4 rounded-xl shadow-lg relative overflow-hidden"><h3 className="text-xs uppercase font-bold opacity-70">Incentive รวม</h3><div className="text-xl font-bold mt-1">฿{calculatedData.totalIncentive.toLocaleString()}</div><DollarSign className="absolute right-2 bottom-2 opacity-10" size={40}/></div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm relative overflow-hidden"><h3 className="text-xs uppercase font-bold text-gray-500">จำนวนรางรวม</h3><div className="text-xl font-bold mt-1 text-gray-800">{calculatedData.totalRails.toLocaleString()} <span className="text-xs font-normal text-gray-400">ราง</span></div><Ruler className="absolute right-2 bottom-2 opacity-10 text-gray-500" size={40}/></div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm relative overflow-hidden"><h3 className="text-xs uppercase font-bold text-gray-500">งานวัดพื้นที่</h3><div className="text-xl font-bold mt-1 text-gray-800">{calculatedData.totalMeasureJobs} <span className="text-xs font-normal text-gray-400">งาน</span></div><MapPin className="absolute right-2 bottom-2 opacity-10 text-gray-500" size={40}/></div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm relative overflow-hidden"><h3 className="text-xs uppercase font-bold text-gray-500">จำนวนช่าง</h3><div className="text-xl font-bold mt-1 text-gray-800">{calculatedData.totalTechs} <span className="text-xs font-normal text-gray-400">คน</span></div><Users className="absolute right-2 bottom-2 opacity-10 text-gray-500" size={40}/></div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm relative overflow-hidden"><h3 className="text-xs uppercase font-bold text-gray-500">จำนวนงาน</h3><div className="text-xl font-bold mt-1 text-gray-800">{calculatedData.periodJobs.length} <span className="text-xs font-normal text-gray-400">งาน</span></div><FileText className="absolute right-2 bottom-2 opacity-10 text-gray-500" size={40}/></div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm relative overflow-hidden"><h3 className="text-xs uppercase font-bold text-gray-500">วันทำการ</h3><div className="text-xl font-bold mt-1 text-gray-800">{calculatedData.periodWorkingDays} <span className="text-xs font-normal text-gray-400">วัน</span></div><CalendarDays className="absolute right-2 bottom-2 opacity-10 text-gray-500" size={40}/></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow border"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BarChart3 size={18}/> ยอด Incentive แยกทีม</h3><div className="space-y-3">{calculatedData.teamStats.map(t => (<div key={t.id}><div className="flex justify-between text-xs mb-1"><span className="font-bold">{t.name}</span><span>฿{Math.round(t.totalEarned).toLocaleString()}</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1"><div className="h-full rounded-full" style={{backgroundColor: themeColor, width: `${(t.totalEarned / (calculatedData.totalIncentive || 1)) * 100}%`}}></div></div><div className="text-[10px] text-gray-500 text-right">จำนวนราง: {t.totalRails.toLocaleString()}</div></div>))}</div></div>
                    <div className="bg-white p-6 rounded-xl shadow border"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={18}/> ยอด Incentive แยกบุคคล</h3><div className="overflow-y-auto max-h-[300px]"><table className="w-full text-xs"><thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 text-left">ชื่อ</th><th className="p-2 text-left">ทีม</th><th className="p-2 text-right">วัน</th><th className="p-2 text-right">ยอด</th></tr></thead><tbody className="divide-y">{calculatedData.individualStats.map((m, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-2 font-medium">{m.name}</td><td className="p-2 text-gray-500">{m.teamName}</td><td className="p-2 text-right">{m.workDays}</td><td className="p-2 text-right font-bold text-green-700">฿{Math.round(m.incentive).toLocaleString()}</td></tr>))}</tbody></table></div></div>
                </div>
             </div>
          )}

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
             <div className="bg-white rounded-xl shadow border overflow-hidden">
                 <div className="p-4 border-b flex justify-between items-center bg-gray-50 gap-4">
                     <h3 className="font-bold text-gray-700 whitespace-nowrap">รายการงาน</h3>
                     <div className="flex-1 max-w-md relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="ค้นหา: ชื่อลูกค้า, เลข Order, วันที่..." className="w-full pl-9 pr-4 py-1.5 border rounded-lg text-xs focus:outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>{searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>)}</div>
                     <div className="flex gap-2"><button onClick={exportToCSV} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 hover:opacity-90"><FileSpreadsheet size={14}/> CSV</button><button onClick={initiateAddJob} style={{backgroundColor: themeColor}} className="text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 hover:opacity-90"><Plus size={14}/> เพิ่ม</button></div>
                 </div>
                 <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-100 text-xs text-gray-500 font-bold uppercase"><tr><th className="p-3 text-center">#</th><th className="p-3">วันที่/เวลา</th><th className="p-3">รายละเอียด</th><th className="p-3">งาน</th><th className="p-3 text-center">ราง</th><th className="p-3">ทีมช่าง</th><th className="p-3 text-right">Incentive</th><th className="p-3 text-center">ลำดับ</th><th className="p-3"></th></tr></thead><tbody className="divide-y text-xs">{calculatedData.periodJobs.filter(j => { const q = searchQuery.toLowerCase(); return !q || (j.customer || '').toLowerCase().includes(q) || (j.orderNo || '').toLowerCase().includes(q) || (j.date || '').includes(q); }).map((j, i) => (<tr key={j.id} className="hover:bg-gray-50"><td className="p-3 text-center text-gray-400">{i+1}</td><td className="p-3 w-36 align-top"><input type="date" value={j.date} onChange={e=>updateJob(j.id,'date',e.target.value)} className="border rounded p-1 w-full mb-1"/><select className="border rounded p-1 w-full text-[10px]" value={j.timeSlot || DEFAULT_TIME_SLOT} onChange={e=>updateJob(j.id,'timeSlot',e.target.value)}>{TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}</select></td><td className="p-3 w-48 align-top space-y-1"><input placeholder="Order No." value={j.orderNo || ''} onChange={e=>updateJob(j.id,'orderNo',e.target.value)} className="border rounded p-1 w-full font-bold"/><input placeholder="ลูกค้า" value={j.customer||''} onChange={e=>updateJob(j.id,'customer',e.target.value)} className="border rounded p-1 w-full"/><input placeholder="สถานที่" value={j.location||''} onChange={e=>updateJob(j.id,'location',e.target.value)} className="border rounded p-1 w-full"/></td><td className="p-3 align-top"><select value={j.type} onChange={e=>updateJob(j.id,'type',e.target.value)} className="border rounded p-1 w-full">{JOB_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></td><td className="p-3 align-top"><input type="number" value={j.rails} onChange={e=>updateJob(j.id,'rails',e.target.value)} className="border rounded p-1 w-12 text-center"/></td><td className="p-3 align-top"><div className="flex flex-wrap gap-1">{teams.map(t => (
                   <div key={t.id} className="border p-1 rounded bg-white">
                       <div className="font-bold text-[9px] mb-1">{t.name}</div>
                       <div className="flex gap-1 flex-wrap">
                           {(t.members || []).map((m, mIdx) => {
                               const isSelected = (j.selectedTechs || []).includes(m.id);
                               const leave = leaves.find(l => l.techId === m.id && l.date === j.date);
                               const isLeave = !!leave;
                               return (
                                 <button 
                                   key={`${m.id}-${mIdx}`} 
                                   onClick={() => !isLeave && toggleTech(j.id, m.id)} 
                                   disabled={isLeave}
                                   style={isSelected ? {backgroundColor: themeColor, color: 'white', borderColor: themeColor} : {}}
                                   className={`px-1.5 py-0.5 rounded text-[9px] border 
                                     ${!isSelected && !isLeave ? 'bg-gray-100 text-gray-500' : ''}
                                     ${isLeave ? 'opacity-40 cursor-not-allowed bg-red-100 text-red-400 border-red-200' : ''}
                                   `}
                                   title={isLeave ? `ลา: ${LEAVE_TYPES.find(lt=>lt.id===leave.type)?.label}` : ''}
                                 >
                                   {m.name}
                                 </button>
                               );
                           })}
                       </div>
                   </div>
               ))}</div></td><td className="p-3 text-right align-top font-bold">฿{j.calculatedValue.toLocaleString()}</td><td className="p-3 text-center align-top"><div className="flex flex-col items-center"><button onClick={()=>moveJob(j.id, -1, calculatedData.periodJobs)} className="text-gray-400 hover:text-black"><ArrowUp size={12}/></button><button onClick={()=>moveJob(j.id, 1, calculatedData.periodJobs)} className="text-gray-400 hover:text-black"><ArrowDown size={12}/></button></div></td><td className="p-3 text-center align-top"><button onClick={()=>removeJob(j.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div>
             </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teams.map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-xl shadow border relative group">
                          <button onClick={()=>handleDeleteTeam(t.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                          <h3 className="font-bold text-lg mb-2">{t.name}</h3>
                          <ul className="space-y-2 mb-4">
                            {(t.members||[]).map((m, mIdx) => (
                                <li key={`${m.id}-${mIdx}`} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded hover:bg-gray-100">
                                    {editingMember?.memberId === m.id ? (
                                        <div className="flex-1 space-y-2">
                                            <input className="border rounded w-full p-1" value={editingMember.data.name} onChange={e=>setEditingMember({...editingMember, data:{...editingMember.data, name:e.target.value}})} />
                                            <div className="flex gap-1"><span className="w-8">เริ่ม:</span><input type="date" className="border rounded p-1" value={editingMember.data.joinDate} onChange={e=>setEditingMember({...editingMember, data:{...editingMember.data, joinDate:e.target.value}})} /></div>
                                            <div className="flex gap-1"><span className="w-8">ออก:</span><input type="date" className="border rounded p-1" value={editingMember.data.resignDate} onChange={e=>setEditingMember({...editingMember, data:{...editingMember.data, resignDate:e.target.value}})} /></div>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={handleUpdateMember} style={{backgroundColor: themeColor}} className="text-white px-2 py-1 rounded">บันทึก</button>
                                                <button onClick={()=>setEditingMember(null)} className="bg-gray-200 px-2 py-1 rounded">ยกเลิก</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <div className="font-medium">{m.name}</div>
                                                <div className="text-[10px] text-gray-400">{formatDate(m.joinDate)} {m.resignDate ? `- ${formatDate(m.resignDate)}` : ''}</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingMember({ teamId: t.id, memberId: m.id, data: { name: m.name, joinDate: m.joinDate, resignDate: m.resignDate || '' } })} className="text-gray-300 hover:text-black"><Pencil size={12}/></button>
                                                <button onClick={()=>handleDeleteMember(t.id, m.id)} className="text-gray-300 hover:text-red-500"><X size={12}/></button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                          </ul>
                          {addingMemberTo === t.id ? (<div className="bg-gray-50 p-2 rounded space-y-2"><input placeholder="ชื่อ" className="border w-full p-1 text-xs rounded" value={newMember.name} onChange={e=>setNewMember({...newMember, name:e.target.value})}/><div className="flex gap-1"><span className="text-[10px] w-8 pt-1">เริ่ม:</span><input type="date" className="border w-full p-1 text-xs rounded" value={newMember.joinDate} onChange={e=>setNewMember({...newMember, joinDate:e.target.value})}/></div><div className="flex gap-1"><span className="text-[10px] w-8 pt-1">ออก:</span><input type="date" className="border w-full p-1 text-xs rounded" value={newMember.resignDate} onChange={e=>setNewMember({...newMember, resignDate:e.target.value})}/></div><div className="flex gap-1"><button onClick={()=>handleAddMember(t.id)} style={{backgroundColor: themeColor}} className="text-white w-full rounded text-xs py-1">Save</button><button onClick={()=>setAddingMemberTo(null)} className="bg-gray-200 w-full rounded text-xs py-1">Cancel</button></div></div>) : (<button onClick={()=>{setAddingMemberTo(t.id); setNewMember({name:'',joinDate:new Date().toISOString().split('T')[0], resignDate: ''})}} className="w-full border-2 border-dashed p-2 rounded text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600">+ เพิ่มช่าง</button>)}
                      </div>
                  ))}
                  {isAddingTeam ? (<div className="bg-white p-4 rounded-xl shadow border"><input placeholder="ชื่อทีม" className="border w-full p-2 mb-2 rounded" autoFocus value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}/><div className="flex gap-2"><button onClick={handleAddTeam} style={{backgroundColor: themeColor}} className="text-white flex-1 py-2 rounded">สร้าง</button><button onClick={()=>setIsAddingTeam(false)} className="bg-gray-100 flex-1 py-2 rounded">ยกเลิก</button></div></div>) : <button onClick={()=>setIsAddingTeam(true)} className="bg-gray-50 border-2 border-dashed rounded-xl flex items-center justify-center p-8 text-gray-400 hover:bg-white hover:border-gray-800 transition-all"><Plus size={32}/></button>}
              </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow border">
                      <h3 className="font-bold mb-4 flex items-center gap-2"><Calendar className="text-red-500"/> วันหยุดบริษัท</h3>
                      <div className="grid grid-cols-7 text-center text-xs gap-1 mb-2">{['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => (<div key={d} className="font-bold text-gray-400 py-1">{d}</div>))}</div>
                      <div className="grid grid-cols-7 text-center text-xs gap-1">
                          {(() => {
                              const days = getDaysArray(period.start, period.end);
                              if (days.length === 0) return null;
                              const [y, m, d] = days[0].split('-').map(Number);
                              const firstDate = new Date(y, m - 1, d);
                              const startOffset = firstDate.getDay(); 
                              return (
                                  <>
                                    {Array(startOffset).fill(null).map((_,i)=><div key={`b${i}`} className="p-2 bg-gray-50/50 border border-transparent"></div>)}
                                    {days.map(dStr => {
                                        const dayNum = parseInt(dStr.split('-')[2], 10);
                                        return <button key={dStr} onClick={()=>handleAddHoliday(dStr)} className={`p-2 rounded border flex flex-col items-center justify-center h-16 ${holidays.includes(dStr)?'bg-red-50 border-red-200 text-red-600 font-bold':'hover:bg-gray-50'}`}><span className="text-lg">{dayNum}</span></button>
                                    })}
                                  </>
                              )
                          })()}
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow border">
                      <h3 className="font-bold mb-4 flex items-center gap-2"><Users className="text-orange-500"/> วันลาพนักงาน</h3>
                      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left sticky left-0 bg-white p-2 min-w-[100px]">ชื่อ</th>{getDaysArray(period.start, period.end).map(d=><th key={d} className="min-w-[30px] p-1 text-center bg-gray-50 border-b"><div className="text-[8px] text-gray-400">{parseInt(d.split('-')[2])}</div></th>)}</tr></thead>
                      <tbody>
                      {teams.flatMap(t => (t.members||[]).map(m => ({ ...m, teamId: t.id }))).map((m, flatIdx) => (
                            <tr key={`${m.id}-${flatIdx}`} className="hover:bg-gray-50">
                                <td className="py-2 sticky left-0 bg-white border-r font-medium pl-2">{m.name}</td>
                                {getDaysArray(period.start, period.end).map(d => {
                                    const l = leaves.find(x => x.techId === m.id && x.date === d);
                                    const holiday = holidays.includes(d);
                                    const leaveType = l ? LEAVE_TYPES.find(t => t.id === l.type) : null;
                                    return <td key={d} onClick={(e) => !holiday && openLeaveMenu(e, m.id, d)} className={`border text-center cursor-pointer ${holiday ? 'bg-red-50' : ''} ${leaveType ? leaveType.color : ''}`}>{leaveType ? leaveType.short : ''}</td>
                                })}
                            </tr>
                        ))}
                      </tbody></table></div>
                  </div>
              </div>
          )}

          {/* New Reports Tab */}
          {activeTab === 'reports' && (
              <div className="bg-white rounded-xl shadow border overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 no-print">
                      <div className="flex gap-4">
                          <button onClick={() => setReportType('team')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${reportType === 'team' ? 'border-black text-black' : 'border-transparent text-gray-400'}`} style={reportType === 'team' ? {borderColor: themeColor, color: themeColor} : {}}>รายงานแยกตามทีม</button>
                          <button onClick={() => setReportType('tech')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${reportType === 'tech' ? 'border-black text-black' : 'border-transparent text-gray-400'}`} style={reportType === 'tech' ? {borderColor: themeColor, color: themeColor} : {}}>รายงานแยกตามบุคคล</button>
                      </div>
                      <button onClick={() => window.print()} style={{backgroundColor: themeColor}} className="text-white px-4 py-2 rounded flex items-center gap-2 hover:opacity-90"><Printer size={16}/> สั่งพิมพ์ตารางนี้</button>
                  </div>
                  
                  <div className="p-4">
                      {reportType === 'team' && (
                          <div>
                              <div className="mb-4 flex items-center gap-2 no-print">
                                  <label className="font-bold text-gray-700">เลือกทีม:</label>
                                  <select className="border rounded p-2 text-sm" value={selectedReportTeamId} onChange={e=>setSelectedReportTeamId(e.target.value)}>
                                      <option value="">-- กรุณาเลือกทีม --</option>
                                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                              </div>
                              
                              {selectedReportTeamId && calculatedData.reportTeamLogs[selectedReportTeamId] && (
                                  <div className="overflow-x-auto print-only-table">
                                      <h3 className="font-bold text-lg mb-2 text-center hidden print-visible">{calculatedData.reportTeamLogs[selectedReportTeamId].name} <br/><span className="text-sm font-normal">ประจำรอบ {period.name} ({formatDate(period.start)} - {formatDate(period.end)})</span></h3>
                                      <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-gray-100">
                                              <tr><th className="border p-2">วันที่</th><th className="border p-2">เวลา</th><th className="border p-2">งาน</th><th className="border p-2">ลูกค้า</th><th className="border p-2">สถานที่</th><th className="border p-2 text-center">ราง (แบ่ง)</th><th className="border p-2 text-center">จำนวนช่าง (ในทีม)</th><th className="border p-2 text-center">หมายเหตุ</th><th className="border p-2 text-right">Incentive</th></tr>
                                          </thead>
                                          <tbody>
                                              {calculatedData.reportTeamLogs[selectedReportTeamId].rows.map((row, rIdx) => (
                                                  <tr key={rIdx} className={row.isHoliday ? 'bg-red-50 text-red-600 font-bold' : ''}>
                                                      <td className="border p-2 whitespace-nowrap">{formatDate(row.date)}</td>
                                                      {row.isHoliday ? (
                                                          <td colSpan="8" className="border p-2 text-center">วันหยุดบริษัท</td>
                                                      ) : (
                                                          <>
                                                            <td className="border p-2">{row.time}</td>
                                                            <td className="border p-2">{row.type}</td>
                                                            <td className="border p-2">{row.customer}</td>
                                                            <td className="border p-2">{row.location}</td>
                                                            <td className="border p-2 text-center">{row.rails}</td>
                                                            <td className="border p-2 text-center">{row.techs}</td>
                                                            <td className="border p-2 text-center text-[10px] text-gray-500">{row.note}</td>
                                                            <td className="border p-2 text-right">{row.inc !== '-' ? `฿${Number(row.inc).toLocaleString()}` : '-'}</td>
                                                          </>
                                                      )}
                                                  </tr>
                                              ))}
                                              {calculatedData.reportTeamLogs[selectedReportTeamId].rows.length === 0 && <tr><td colSpan="9" className="text-center p-4 text-gray-400">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>}
                                          </tbody>
                                          <tfoot className="bg-gray-100 font-bold">
                                              <tr>
                                                  <td colSpan="5" className="border p-2 text-right">รวมทั้งหมด</td>
                                                  <td className="border p-2 text-center text-blue-700">
                                                      {Number(calculatedData.reportTeamLogs[selectedReportTeamId].rows.reduce((sum, r) => sum + (typeof r.rails === 'number' ? r.rails : 0), 0).toFixed(2))}
                                                  </td>
                                                  <td className="border p-2" colSpan="2"></td>
                                                  <td className="border p-2 text-right text-green-700">
                                                      ฿{Math.round(calculatedData.reportTeamLogs[selectedReportTeamId].rows.reduce((sum, r) => sum + (typeof r.inc === 'number' ? r.inc : 0), 0)).toLocaleString()}
                                                  </td>
                                              </tr>
                                          </tfoot>
                                      </table>
                                  </div>
                              )}
                          </div>
                      )}

                      {reportType === 'tech' && (
                          <div>
                              <div className="mb-4 flex items-center gap-2 no-print">
                                  <label className="font-bold text-gray-700">เลือกพนักงาน:</label>
                                  <select className="border rounded p-2 text-sm" value={selectedReportTechId} onChange={e=>setSelectedReportTechId(e.target.value)}>
                                      <option value="">-- กรุณาเลือกพนักงาน --</option>
                                      {teams.flatMap(t => (t.members||[]).map(m => ({id: m.id, name: m.name, tName: t.name}))).map(m => (
                                          <option key={m.id} value={m.id}>{m.name} ({m.tName})</option>
                                      ))}
                                  </select>
                              </div>

                              {selectedReportTechId && calculatedData.reportTechLogs[selectedReportTechId] && (
                                  <div className="overflow-x-auto print-only-table">
                                      <h3 className="font-bold text-lg mb-2 text-center hidden print-visible">{calculatedData.reportTechLogs[selectedReportTechId].name} <span className="text-sm font-normal text-gray-500">({calculatedData.reportTechLogs[selectedReportTechId].teamName})</span> <br/><span className="text-sm font-normal">ประจำรอบ {period.name} ({formatDate(period.start)} - {formatDate(period.end)})</span></h3>
                                      <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-gray-100">
                                              <tr><th className="border p-2">วันที่</th><th className="border p-2">เวลา</th><th className="border p-2">งาน</th><th className="border p-2">ลูกค้า</th><th className="border p-2">สถานที่</th><th className="border p-2 text-center">ราง (หาร)</th><th className="border p-2 text-center">จำนวนช่าง (ในทีม)</th><th className="border p-2 text-center">หมายเหตุ</th><th className="border p-2 text-right">Incentive</th></tr>
                                          </thead>
                                          <tbody>
                                              {calculatedData.reportTechLogs[selectedReportTechId].rows.map((row, rIdx) => (
                                                  <tr key={rIdx} className={row.isHoliday ? 'bg-red-50 text-red-600 font-bold' : row.isLeave ? 'bg-yellow-50 text-yellow-700' : ''}>
                                                      <td className="border p-2 whitespace-nowrap">{formatDate(row.date)}</td>
                                                      {row.isHoliday ? (
                                                          <td colSpan="8" className="border p-2 text-center">วันหยุดบริษัท</td>
                                                      ) : row.isLeave ? (
                                                          <td colSpan="8" className="border p-2 text-center font-bold">{row.customer}</td>
                                                      ) : (
                                                          <>
                                                            <td className="border p-2">{row.time}</td>
                                                            <td className="border p-2">{row.type}</td>
                                                            <td className="border p-2">{row.customer}</td>
                                                            <td className="border p-2">{row.location}</td>
                                                            <td className="border p-2 text-center">{row.rails}</td>
                                                            <td className="border p-2 text-center">{row.techs}</td>
                                                            <td className="border p-2 text-center text-[10px] text-gray-500">{row.note}</td>
                                                            <td className="border p-2 text-right">{row.inc !== '-' && row.inc > 0 ? `฿${Number(row.inc).toLocaleString()}` : (row.inc === 0 ? '฿0 (ไม่เข้าเกณฑ์)' : '-')}</td>
                                                          </>
                                                      )}
                                                  </tr>
                                              ))}
                                              {calculatedData.reportTechLogs[selectedReportTechId].rows.length === 0 && <tr><td colSpan="9" className="text-center p-4 text-gray-400">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>}
                                          </tbody>
                                          <tfoot className="bg-gray-100 font-bold">
                                              <tr>
                                                  <td colSpan="5" className="border p-2 text-right">รวมทั้งหมด</td>
                                                  <td className="border p-2 text-center text-blue-700">
                                                      {Number(calculatedData.reportTechLogs[selectedReportTechId].rows.reduce((sum, r) => sum + (typeof r.rails === 'number' ? r.rails : 0), 0).toFixed(2))}
                                                  </td>
                                                  <td className="border p-2" colSpan="2"></td>
                                                  <td className="border p-2 text-right text-green-700">
                                                      ฿{Math.round(calculatedData.reportTechLogs[selectedReportTechId].rows.reduce((sum, r) => sum + (typeof r.inc === 'number' ? r.inc : 0), 0)).toLocaleString()}
                                                  </td>
                                              </tr>
                                          </tfoot>
                                      </table>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* Admin Tab */}
          {activeTab === 'admin' && currentUser?.role === 'super_admin' && (
              <div className="bg-white p-6 rounded-xl shadow border max-w-2xl mx-auto">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Shield className="text-blue-600"/> การตั้งค่าผู้ดูแลระบบ (Super Admin)</h3>
                  
                  {/* Theme Settings */}
                  <div className="mb-8 border-b pb-6">
                      <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Palette size={16}/> เปลี่ยนสีธีมหลัก</h4>
                      <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                          <input type="color" value={themeColor} onChange={e=>setThemeColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer"/>
                          <input type="text" value={themeColor} onChange={e=>setThemeColor(e.target.value)} className="border rounded p-2 w-28 text-sm font-mono text-center uppercase" maxLength={7} placeholder="#424242" />
                          <div className="flex-1">
                              <p className="text-xs text-gray-500">สีที่เลือกจะเปลี่ยนสีปุ่มและแถบเมนูทั้งหมดสำหรับผู้ใช้งานทุกคน (พิมพ์ระบุรหัส HEX ได้เลย)</p>
                              <button onClick={() => handleSaveTheme(themeColor)} className="mt-2 text-white px-4 py-1.5 rounded text-xs font-bold" style={{backgroundColor: themeColor}}>บันทึกสี</button>
                          </div>
                      </div>
                  </div>

                  {/* Add New User Form */}
                  <div className="flex flex-col gap-2 mb-6 bg-gray-50 p-4 rounded-lg border">
                      <label className="text-xs font-bold text-gray-600 flex items-center gap-2"><UserPlus size={14}/> เพิ่มผู้ใช้งานใหม่</label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                          <input type="text" placeholder="Username" className="border rounded-lg px-4 py-2 text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                          <input type="text" placeholder="Password" className="border rounded-lg px-4 py-2 text-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                      </div>
                      <div className="flex gap-2">
                          <input type="text" placeholder="ชื่อเรียก (Display Name)" className="flex-1 border rounded-lg px-4 py-2 text-sm" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                          <select className="border rounded-lg px-2 py-2 text-sm bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                          </select>
                          <button onClick={handleAddAppUser} style={{backgroundColor: themeColor}} className="text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">เพิ่ม</button>
                      </div>
                  </div>

                  {/* List Users */}
                  <div className="space-y-2 mb-8">
                      {appUsers.map((u, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                              <div>
                                  <div className="text-sm font-medium text-gray-800">{u.username} <span className="text-gray-400 font-normal">({u.name})</span></div>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                                      <span className="text-[10px] text-gray-400">Pass: {u.password}</span>
                                  </div>
                              </div>
                              {u.username !== DEFAULT_SUPER_ADMIN.username && u.username !== currentUser.username && (
                                  <button onClick={() => handleRemoveAppUser(u.id, u.username)} className="text-gray-300 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-all"><Trash2 size={16}/></button>
                              )}
                          </div>
                      ))}
                  </div>

                  <div className="border-t pt-6">
                      <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Database size={16}/> จัดการฐานข้อมูล</h4>
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex items-center justify-between">
                          <div>
                              <p className="text-sm font-bold text-orange-800">กู้คืนข้อมูลเริ่มต้น (Reset Data)</p>
                              <p className="text-xs text-orange-600 mt-1">ใช้เมื่อข้อมูลทีมช่างหาย หรือต้องการเริ่มระบบใหม่</p>
                          </div>
                          <button onClick={handleSeedData} className="bg-orange-600 text-white px-4 py-2 rounded text-xs hover:bg-orange-700 transition-colors">กู้คืนข้อมูล</button>
                      </div>
                  </div>
              </div>
          )}
        </ErrorBoundary>
      </div>
      
      {/* Print Overlay for Old Summary Report */}
      <div className="print-only p-8">
          {activeTab !== 'reports' && (
              <>
                  <div className="text-center mb-6"><h1 className="text-3xl font-serif font-bold tracking-widest">PASAYA</h1><p className="text-xs tracking-[0.2em] font-sans font-bold mb-4">CURTAIN CENTER</p><h2 className="text-xl">สรุปรายงาน Incentive</h2><p className="text-sm text-gray-500">{period.name} ({formatDate(period.start)} - {formatDate(period.end)})</p></div>
                  <div className="grid grid-cols-1 gap-8">
                     {calculatedData.teamStats.map(t => (
                         <div key={t.id} className="break-inside-avoid">
                             <div className="flex justify-between border-b-2 border-black pb-1 mb-2 font-bold text-lg"><span>{t.name}</span><div className="text-right text-xs font-normal">ราง: {t.totalRails.toLocaleString()} | วัดพื้นที่: {t.totalMeasures}</div><span>ยอดทีม: ฿{Math.round(t.totalEarned).toLocaleString()}</span></div>
                             <table className="w-full text-sm">
                                 <thead><tr className="border-b"><th className="text-left">ชื่อ</th><th className="text-left">วันลา (วันที่ - สาเหตุ)</th><th className="text-center">วันทำงาน</th><th className="text-right">Incentive</th></tr></thead>
                                 <tbody>
                                     {t.members.map(m => (
                                         <tr key={m.id} className="border-b border-gray-100">
                                             <td className="py-1 align-top">{m.name}</td>
                                             <td className="text-left text-xs text-red-500 align-top">{m.leaves.length > 0 ? m.leaves.map(l => (<div key={l.date}>{formatDate(l.date)} - {LEAVE_TYPES.find(typ=>typ.id===l.type)?.label}</div>)) : '-'}</td>
                                             <td className="text-center align-top">{m.workDays}</td><td className="text-right align-top">฿{Math.round(m.incentive).toLocaleString()}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     ))}
                     <div className="text-right font-bold text-xl mt-4 border-t-2 border-black pt-2">รวมทั้งหมด: ฿{Math.round(calculatedData.totalIncentive).toLocaleString()}</div>
                  </div>
              </>
          )}
      </div>
    </div>
  );
}