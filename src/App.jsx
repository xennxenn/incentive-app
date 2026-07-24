// ... existing code ...
const getContrastYIQ = (hexcolor) => {
    if (!hexcolor) return 'white';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
};

// Check if a member belongs to a specific team on a specific date based on their history
const isMemberInTeamOnDate = (member, teamId, targetDate) => {
    if (!member.teamHistory || member.teamHistory.length === 0) {
        return member.currentTeamId === teamId || !member.currentTeamId; 
    }
    const sortedHistory = [...member.teamHistory].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const activeRecord = sortedHistory.find(record => record.effectiveDate <= targetDate);
    if (activeRecord) return activeRecord.teamId === teamId;
    const oldestRecord = sortedHistory[sortedHistory.length - 1];
    return oldestRecord && oldestRecord.teamId === teamId;
};

export default function App() {
  // --- State ---
  const [dbReady, setDbReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false); 
  
  const [teams, setTeams] = useState([]);
  const [allMembers, setAllMembers] = useState([]); // New state for ALL members across teams

  const [holidays, setHolidays] = useState([]); 
// ... existing code ...
  const [searchQuery, setSearchQuery] = useState('');
  const [jobSortOrder, setJobSortOrder] = useState('desc'); 
  
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'admin' });
  const [newPeriodName, setNewPeriodName] = useState('');
  const [notification, setNotification] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);
  
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobDate, setNewJobDate] = useState('');
  const [newJobTimeSlot, setNewJobTimeSlot] = useState(DEFAULT_TIME_SLOT);

  const [activeLeaveCell, setActiveLeaveCell] = useState(null); 
  const [editingPeriod, setEditingPeriod] = useState(null); 
  
  const leaveMenuRef = useRef(null);
  const themeTextColor = useMemo(() => getContrastYIQ(themeColor), [themeColor]);
// ... existing code ...
  useEffect(() => {
    if (!dbReady || !currentUser || !db) { setLoading(false); return; }
    try {
        const unsubTeams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), async (snap) => {
              const list = snap.docs.map(d => ({ ...d.data(), id: d.id })); setTeams(list);
        }, handlePermissionError);

        const unsubMembers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'members'), async (snap) => {
              const list = snap.docs.map(d => ({ ...d.data(), id: d.id })); setAllMembers(list);
        }, handlePermissionError);

        const unsubJobs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), (s) => setJobs(s.docs.map(d => ({ ...d.data(), id: d.id }))), handlePermissionError);
// ... existing code ...
        const unsubHols = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'holidays'), (s) => setHolidays(s.docs.map(d => d.data().date)), handlePermissionError);
        const unsubPeriods = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'savedPeriods'), (s) => { setSavedPeriods(s.docs.map(d => ({ ...d.data(), id: d.id }))); setLoading(false); }, handlePermissionError);
        return () => { unsubTeams(); unsubMembers(); unsubJobs(); unsubLeaves(); unsubHols(); unsubPeriods(); };
    } catch (e) {}
  }, [dbReady, currentUser]);

// ... existing code ...
  const handleAddAppUser = async () => {
      if (!newUser.username || !newUser.password) return showNotification('กรุณากรอกข้อมูล', 'error');
      if (appUsers.some(u => u.username === newUser.username)) return showNotification('Username ซ้ำ', 'error');
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'app_users'), newUser); setNewUser({ username: '', password: '', name: '', role: 'admin' }); showNotification('เพิ่มผู้ใช้งานสำเร็จ'); } catch (e) { handlePermissionError(e); }
  };

  const handleRemoveAppUser = (id, username) => {
// ... existing code ...
  const handleCleanGhostData = async () => {
      requestConfirm('ล้างข้อมูลช่างตกค้าง', 'ระบบจะค้นหาและลบรายชื่อช่างที่ถูกลบไปแล้วแต่ยังค้างอยู่ในงาน ยืนยันหรือไม่?', async () => {
          try {
              const batch = writeBatch(db);
              let cleanedCount = 0;
              const validMemberIds = new Set(allMembers.map(m => m.id));

              jobs.forEach(job => {
                  const originalTechs = job.selectedTechs || [];
                  const validTechs = originalTechs.filter(id => validMemberIds.has(id));
                  
                  if (validTechs.length !== originalTechs.length) {
                      const jobRef = doc(db, 'artifacts', appId, 'public', 'data', 'jobs', job.id);
// ... existing code ...
              setConfirmModal(null);
          } catch (e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      });
  };

  // --- Seed Data Handler (RESTORED) ---
  const handleSeedData = async () => { 
      requestConfirm('กู้คืนข้อมูลเริ่มต้น', 'ยืนยันการล้างข้อมูลทีมและช่างทั้งหมดเพื่อเริ่มใหม่?', async () => { 
          try {
              // ล้างข้อมูลสมาชิกเก่า
              const membersSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'members'));
              const batch = writeBatch(db); 
              membersSnap.forEach(d => batch.delete(d.ref));
              
              // ล้างข้อมูลทีมเก่า
              const teamsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'teams'));
              teamsSnap.forEach(d => batch.delete(d.ref));
              
              await batch.commit(); 

              // สร้างข้อมูลใหม่ตามโครงสร้าง V7
              const seedTeams = [
                  { name: 'ทีมช่างนาย', members: [{name: 'ช่างนาย', joinDate: '2024-01-01'}, {name: 'ช่างอาท', joinDate: '2024-01-01'}, {name: 'ช่างลิด', joinDate: '2024-01-01'}] },
                  { name: 'ทีมช่างเบนซ์', members: [{name: 'ช่างเบนซ์', joinDate: '2024-01-01'}, {name: 'ช่างกี้', joinDate: '2024-01-01'}] },
                  { name: 'ทีมช่างอั้ม', members: [{name: 'ช่างอั้ม', joinDate: '2024-01-01'}, {name: 'ช่างต้อม', joinDate: '2024-01-01'}, {name: 'ช่างทัด', joinDate: '2024-01-01'}] },
                  { name: 'ทีมตัววิ่ง', members: [{name: 'ช่างเวียร์', joinDate: '2024-01-01'}] },
                  { name: 'ทีมวัดพื้นที่', members: [] },
              ];

              for (const teamData of seedTeams) {
                  const teamRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), { name: teamData.name, createdAt: new Date().toISOString() });
                  
                  for (const m of teamData.members) {
                      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'members'), {
                          name: m.name,
                          joinDate: m.joinDate,
                          resignDate: '',
                          currentTeamId: teamRef.id,
                          teamHistory: [{ teamId: teamRef.id, effectiveDate: m.joinDate }],
                          createdAt: new Date().toISOString()
                      });
                  }
              }
              setConfirmModal(null); 
              showNotification('กู้คืนข้อมูลสำเร็จ ระบบจะแสดงข้อมูลใหม่ในสักครู่');
          } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
      }); 
  };

  const handleAddTeam = async () => { 
      if(!newTeamName) return;
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), { name: newTeamName, createdAt: new Date().toISOString() }); setIsAddingTeam(false); showNotification('เพิ่มสำเร็จ'); } catch(e) { handlePermissionError(e); }
  };

  const handleDeleteTeam = (id) => requestConfirm('ลบทีม', 'ยืนยัน?', async () => { 
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', id)); setConfirmModal(null); } catch(e) { handlePermissionError(e); }
  });

  const handleAddMember = async (teamId) => { 
      if(newMember.name) { 
          try {
              const memberData = {
                  name: newMember.name,
                  joinDate: newMember.joinDate || new Date().toISOString().split('T')[0],
                  resignDate: newMember.resignDate || '',
                  currentTeamId: teamId,
                  teamHistory: [
                      { teamId: teamId, effectiveDate: newMember.joinDate || new Date().toISOString().split('T')[0] }
                  ],
                  createdAt: new Date().toISOString()
              };
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'members'), memberData); 
              setAddingMemberTo(null); setNewMember({ name: '', joinDate: '', resignDate: '' }); showNotification('เพิ่มช่างสำเร็จ');
          } catch(e) { handlePermissionError(e); }
      } 
  };
  
  const handleUpdateMember = async () => {
      if (!editingMember) return;
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', editingMember.id), {
              name: editingMember.name,
              joinDate: editingMember.joinDate,
              resignDate: editingMember.resignDate
          });
          setEditingMember(null); showNotification('อัปเดตข้อมูลช่างสำเร็จ');
      } catch(e) { handlePermissionError(e); }
  };
  
  const handleDeleteMember = (memberId) => requestConfirm('ลบช่าง', 'ยืนยันลบช่างคนนี้ออกจากระบบถาวร?', async () => { 
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', memberId)); setConfirmModal(null); showNotification('ลบช่างสำเร็จ'); } catch(e) { handlePermissionError(e); }
  });

  const confirmMigration = async () => {
      if (!transferringMember || !transferringMember.targetTeamId || !transferringMember.date) return;
      const member = allMembers.find(m => m.id === transferringMember.member.id);
      if (!member) return;

      try {
          const newHistory = [...(member.teamHistory || [])];
          newHistory.push({
              teamId: transferringMember.targetTeamId,
              effectiveDate: transferringMember.date
          });
          
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', member.id), {
              currentTeamId: transferringMember.targetTeamId,
              teamHistory: newHistory
          });
          
          setTransferringMember(null);
          showNotification('ย้ายทีมสำเร็จ (มีผลตามวันที่กำหนด)');
      } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  };

  const removeMigrationHistory = async (memberId, historyIndex) => {
      const member = allMembers.find(m => m.id === memberId);
      if (!member || !member.teamHistory || member.teamHistory.length <= 1) {
          showNotification('ต้องมีประวัติอย่างน้อย 1 รายการเสมอ', 'error'); return;
      }
      try {
          const newHistory = [...member.teamHistory];
          newHistory.splice(historyIndex, 1);
          const sorted = [...newHistory].sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate));
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', memberId), {
              currentTeamId: sorted[0].teamId,
              teamHistory: newHistory
          });
          showNotification('ลบประวัติการย้ายทีมสำเร็จ');
      } catch(e) { handlePermissionError(e); showNotification(`Error: ${e.message}`, 'error'); }
  };
  
  const initiateAddJob = () => { 
// ... existing code ...
        const dailyTeamIncentive = {}; 
        let globalTotalRails = 0; let globalTotalMeasureJobs = 0;

        periodJobs.forEach(job => {
            let val = 0; 
            const rails = parseInt(job.rails) || 0;
            const excludedTypes = ['measure', 'travel_go', 'travel_back', 'fix_free'];
            
            if (!excludedTypes.includes(job.type)) globalTotalRails += rails;
            if (job.type === 'measure') globalTotalMeasureJobs += 1;

            // ⚡️ FILTER 1: นับเฉพาะช่างที่มีตัวตนในปัจจุบัน
            const validTechs = (job.selectedTechs || []).filter(tid => allMembers.some(m => m.id === tid));
            
            // ⚡️ FILTER 2: กรองคนที่ไม่ได้ติดสถานะ no_inc
            const payingTechs = validTechs.filter(tid => {
                const l = leaves.find(x => x.techId === tid && x.date === job.date);
                return !(l && l.type === 'no_inc');
            });

            const cnt = payingTechs.length; 

            if (cnt === 0) {
                val = 0;
            } else {
                if (job.type === 'measure') val = 250 * cnt;
                else if (['travel_go', 'travel_back', 'fix_free'].includes(job.type)) val = 0;
                else val = (250 * cnt) + (rails > 10 ? (rails - 10) * 20 : 0);
            }
            job.calculatedValue = val; 

            if (cnt > 0) {
                const teamsInvolved = {}; let totalTechsInJob = 0;
                payingTechs.forEach(tid => {
                    const member = allMembers.find(m => m.id === tid);
                    if(member){
                        const t = teams.find(x => isMemberInTeamOnDate(member, x.id, job.date));
                        if (t) { teamsInvolved[t.id] = (teamsInvolved[t.id] || 0) + 1; totalTechsInJob++; }
                    }
                });
                
                const date = job.date;
                if (!dailyTeamIncentive[date]) dailyTeamIncentive[date] = {};

                Object.keys(teamsInvolved).forEach(teamId => {
// ... existing code ...
        const daysInPeriod = getDaysArray(period.start, period.end);
        const periodWorkingDays = daysInPeriod.filter(d => !holidays.includes(d)).length;
        
        const reportTeamLogs = {}; const reportTechLogs = {};
        teams.forEach(t => { reportTeamLogs[t.id] = { name: t.name, rows: [] }; });
        allMembers.forEach(m => { reportTechLogs[m.id] = { name: m.name, teamName: teams.find(t=>t.id===m.currentTeamId)?.name || '-', rows: [] }; });

        const teamStatsMap = {};
        teams.forEach(t => teamStatsMap[t.id] = { ...t, totalEarned: 0, totalRails: 0, totalMeasures: 0, membersMap: {} });
        allMembers.forEach(m => {
            const fallbackTeam = m.currentTeamId || teams[0]?.id;
            if (teamStatsMap[fallbackTeam]) {
                teamStatsMap[fallbackTeam].membersMap[m.id] = { ...m, incentive: 0, workDays: 0, leaves: [] };
            }
        });
        
        const memberEarnings = {};
        allMembers.forEach(m => memberEarnings[m.id] = 0);

        daysInPeriod.forEach(day => {
            const isHol = holidays.includes(day);
            const dayTeamMembers = {};
            teams.forEach(t => dayTeamMembers[t.id] = []);

            allMembers.forEach(m => {
                const activeTeam = teams.find(t => isMemberInTeamOnDate(m, t.id, day));
                if (activeTeam) { dayTeamMembers[activeTeam.id].push(m); }
                
                if (!isHol) {
                    const leave = leaves.find(l => l.techId === m.id && l.date === day);
                    if (leave) {
                        const currentTeamStat = teamStatsMap[activeTeam?.id || m.currentTeamId];
                        if (currentTeamStat && currentTeamStat.membersMap[m.id]) {
                            currentTeamStat.membersMap[m.id].leaves.push({ date: day, type: leave.type });
                        }
                        const lName = LEAVE_TYPES.find(x => x.id === leave.type)?.label || 'ลา';
                        if (leave.type === 'no_inc') {
                            reportTechLogs[m.id].rows.push({ isLeave: true, date: day, time: '-', type: '-', customer: `สถานะ: ${lName}`, location: '-', rails: '-', techs: '-', note: '-', inc: '-', effectiveTeamName: activeTeam?.name || '-' });
                        } else {
                            reportTechLogs[m.id].rows.push({ isLeave: true, date: day, time: '-', type: '-', customer: `ลา (${lName})`, location: '-', rails: '-', techs: '-', note: '-', inc: '-', effectiveTeamName: activeTeam?.name || '-' });
                        }
                    } else {
                        if (m.joinDate <= day && (!m.resignDate || m.resignDate > day)) {
                             const currentTeamStat = teamStatsMap[activeTeam?.id || m.currentTeamId];
                             if (currentTeamStat && currentTeamStat.membersMap[m.id]) {
                                 currentTeamStat.membersMap[m.id].workDays++;
                             }
                        }
                    }
                }
            });

            teams.forEach(team => {
                const membersList = dayTeamMembers[team.id] || [];
                const dayStats = dailyTeamIncentive[day]?.[team.id];

                if (isHol) {
                    reportTeamLogs[team.id].rows.push({ isHoliday: true, date: day, time: '-', type: '-', customer: 'วันหยุดบริษัท', location: '-', rails: '-', techs: '-', note: '-', inc: '-' });
                    membersList.forEach(m => { reportTechLogs[m.id].rows.push({ isHoliday: true, date: day, time: '-', type: '-', customer: 'วันหยุดบริษัท', location: '-', rails: '-', techs: '-', note: '-', inc: '-', effectiveTeamName: team.name }); });
                }

                const dayJobs = periodJobs.filter(j => j.date === day).sort((a,b) => (a.timeSlot||'').localeCompare(b.timeSlot||''));
                dayJobs.forEach(job => {
                    const involvedTeams = {};
                    
                    const validTechsInJob = (job.selectedTechs || []).filter(tid => allMembers.some(m => m.id === tid));
                    const totalTechsInJob = validTechsInJob.length; 
                    
                    validTechsInJob.forEach(tid => {
                        const member = allMembers.find(x => x.id === tid);
                        if(member){
                            const tMatch = teams.find(x => isMemberInTeamOnDate(member, x.id, day));
                            if (tMatch) { if (!involvedTeams[tMatch.id]) involvedTeams[tMatch.id] = []; involvedTeams[tMatch.id].push(tid); }
                        }
                    });

                    const totalTeams = Object.keys(involvedTeams).length;
                    const isShared = totalTeams > 1;
                    const excludedTypes = ['measure', 'travel_go', 'travel_back', 'fix_free'];
                    const isExcluded = excludedTypes.includes(job.type);
                    
                    if (involvedTeams[team.id]) {
                        const teamTechs = involvedTeams[team.id];
                        const teamTechCount = teamTechs.length;
                        const jobVal = job.calculatedValue || 0;
                        const jobRails = parseInt(job.rails) || 0;
                        
                        const teamShareAmt = totalTechsInJob > 0 ? (jobVal * teamTechCount) / totalTechsInJob : 0;
                        const teamRailsShare = isExcluded ? 0 : (jobRails / totalTeams);
                        const typeLabel = JOB_TYPES.find(t=>t.id===job.type)?.label || job.type;
                        const noteStr = isShared ? 'งานควบ' : '';

                        reportTeamLogs[team.id].rows.push({ date: job.date, time: job.timeSlot || '-', type: typeLabel, customer: job.customer || '-', location: job.location || '-', rails: isExcluded ? '-' : Number(teamRailsShare.toFixed(2)), techs: teamTechCount, note: noteStr, inc: teamShareAmt });

                        const activeMembers = membersList.filter(m => m.joinDate <= day && (!m.resignDate || m.resignDate > day));
                        
                        const eligibleMembers = activeMembers.filter(m => {
                            const leave = leaves.find(l => l.techId === m.id && l.date === day);
                            return !leave || leave.type === 'vacation';
                        });
                        
                        const sharePerHead = eligibleMembers.length > 0 ? teamShareAmt / eligibleMembers.length : 0;
                        const railsPerHead = eligibleMembers.length > 0 ? teamRailsShare / eligibleMembers.length : 0;

                        activeMembers.forEach(m => {
                            const isEligible = eligibleMembers.some(em => em.id === m.id);
                            const isNoInc = leaves.find(l => l.techId === m.id && l.date === job.date)?.type === 'no_inc';
                            
                            let noteDisplay = noteStr;
                            if (isNoInc) noteDisplay = noteStr ? `${noteStr} (No Incentive)` : 'No Incentive';

                            reportTechLogs[m.id].rows.push({
                                date: job.date, time: job.timeSlot || '-', type: typeLabel, customer: job.customer || '-', location: job.location || '-', rails: isExcluded ? '-' : (isEligible ? Number(railsPerHead.toFixed(2)) : 0), techs: teamTechCount, note: noteDisplay, inc: isEligible ? sharePerHead : 0, effectiveTeamName: team.name
                            });
                        });
                    }
                });

                if (dayStats) { 
                    teamStatsMap[team.id].totalRails += dayStats.rails; teamStatsMap[team.id].totalMeasures += dayStats.measures; 
                    const dailyPot = dayStats.amount || 0;
                    if (dailyPot > 0) {
                        teamStatsMap[team.id].totalEarned += dailyPot;
                        const activeMembers = membersList.filter(m => m.joinDate <= day && (!m.resignDate || m.resignDate > day));
                        const eligibleMembers = activeMembers.filter(m => {
                            const leave = leaves.find(l => l.techId === m.id && l.date === day);
                            return !leave || leave.type === 'vacation';
                        });
                        const sharePerHead = eligibleMembers.length > 0 ? dailyPot / eligibleMembers.length : 0;
                        activeMembers.forEach(m => { if (eligibleMembers.some(em => em.id === m.id)) memberEarnings[m.id] += sharePerHead; });
                    }
                }
            });
        });

        let exactTotalIncentive = 0;
        const teamStats = teams.map(t => {
            exactTotalIncentive += teamStatsMap[t.id].totalEarned;
            return {
                ...t,
                totalEarned: teamStatsMap[t.id].totalEarned,
                totalRails: teamStatsMap[t.id].totalRails,
                totalMeasures: teamStatsMap[t.id].totalMeasures,
                members: Object.values(teamStatsMap[t.id].membersMap).map(m => ({
                    ...m,
                    incentive: memberEarnings[m.id] || 0
                }))
            };
        });

        const individualStats = allMembers.map(m => {
            const currentTeamName = teams.find(t => t.id === m.currentTeamId)?.name || 'ไม่มีทีม';
            const workDays = teamStatsMap[m.currentTeamId]?.membersMap[m.id]?.workDays || 0;
            return {
                ...m,
                teamName: currentTeamName,
                workDays: workDays,
                incentive: memberEarnings[m.id] || 0
            }
        }).sort((a,b) => b.incentive - a.incentive);

        const totalTechs = allMembers.filter(m => m.joinDate <= period.end && (!m.resignDate || m.resignDate > period.start)).length;

        return { periodJobs, totalIncentive: Math.round(exactTotalIncentive), teamStats, individualStats, totalTechs, periodWorkingDays, totalRails: globalTotalRails, totalMeasureJobs: globalTotalMeasureJobs, reportTeamLogs, reportTechLogs };
    } catch (e) { return { periodJobs: [], totalIncentive: 0, teamStats: [], individualStats: [], totalTechs: 0, periodWorkingDays: 0, totalRails: 0, totalMeasureJobs: 0, reportTeamLogs: {}, reportTechLogs: {} }; }
  }, [jobs, teams, allMembers, holidays, leaves, period, jobSortOrder]);

  const exportToCSV = () => {
      const headers = ["วันที่", "ลูกค้า", "สถานที่", "Order No", "เวลา", "ประเภทงาน", "จำนวนราง", "ทีมช่าง", "รายชื่อช่าง", "ตรวจสอบ", "ค่า Incentive"];
      const rows = calculatedData.periodJobs.map(j => {
          const tNames = allMembers.filter(m => (j.selectedTechs || []).includes(m.id)).map(m => {
              const activeTeam = teams.find(t => isMemberInTeamOnDate(m, t.id, j.date));
              return `${m.name} (${activeTeam ? activeTeam.name : 'Unknown'})`;
          }).join(", ");
          return [ j.date, `"${(j.customer||'').replace(/"/g,'""')}"`, `"${(j.location||'').replace(/"/g,'""')}"`, `"${(j.orderNo||'').replace(/"/g,'""')}"`, j.timeSlot || `${j.timeIn || ''} - ${j.timeOut || ''}`, JOB_TYPES.find(t => t.id === j.type)?.label || j.type, j.rails, `"${tNames}"`, j.isChecked ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ', j.calculatedValue ].join(",");
      });
      const blob = new Blob(["\uFEFF" + [headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `report.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
// ... existing code ...
                     <div className="flex gap-2">
                         <select className="border rounded-lg text-xs px-2 py-1.5 bg-white" value={jobSortOrder} onChange={(e) => setJobSortOrder(e.target.value)}><option value="desc">เรียงเวลา: ล่าสุดขึ้นก่อน</option><option value="asc">เรียงเวลา: เก่าสุดขึ้นก่อน</option></select>
                         <button onClick={exportToCSV} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1"><FileSpreadsheet size={14}/> CSV</button>
                         <button onClick={initiateAddJob} style={{backgroundColor: themeColor, color: themeTextColor}} className="px-3 py-1.5 rounded text-xs flex items-center gap-1 hover:opacity-90"><Plus size={14}/> เพิ่ม</button>
                     </div>
                 </div>
                 <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-100 text-xs text-gray-500 font-bold uppercase"><tr><th className="p-3 text-center">#</th><th className="p-3">วันที่/เวลา</th><th className="p-3">รายละเอียด</th><th className="p-3">งาน</th><th className="p-3 text-center">ราง</th><th className="p-3">ทีมช่าง (จัดทีมตามวัน)</th><th className="p-3 text-right">Incentive</th><th className="p-3 text-center">ตรวจสอบ</th><th className="p-3 text-center">ลำดับ</th><th className="p-3"></th></tr></thead><tbody className="divide-y text-xs">{calculatedData.periodJobs.filter(j => { const q = searchQuery.toLowerCase(); return !q || (j.customer || '').toLowerCase().includes(q) || (j.orderNo || '').toLowerCase().includes(q) || (j.date || '').includes(q); }).map((j, i) => (<tr key={j.id} className={`hover:bg-gray-50 ${j.isChecked ? 'bg-green-50/30' : ''}`}><td className="p-3 text-center text-gray-400">{i+1}</td><td className="p-3 w-36 align-top"><input type="date" value={j.date} onChange={e=>updateJob(j.id,'date',e.target.value)} className="border rounded p-1 w-full mb-1"/><select className="border rounded p-1 w-full text-[10px]" value={j.timeSlot || DEFAULT_TIME_SLOT} onChange={e=>updateJob(j.id,'timeSlot',e.target.value)}>{TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}</select></td><td className="p-3 w-48 align-top space-y-1"><input placeholder="Order No." value={j.orderNo || ''} onChange={e=>updateJob(j.id,'orderNo',e.target.value)} className="border rounded p-1 w-full bg-blue-50 font-bold"/><input placeholder="ลูกค้า" value={j.customer||''} onChange={e=>updateJob(j.id,'customer',e.target.value)} className="border rounded p-1 w-full"/><input placeholder="สถานที่" value={j.location||''} onChange={e=>updateJob(j.id,'location',e.target.value)} className="border rounded p-1 w-full"/></td><td className="p-3 align-top"><select value={j.type} onChange={e=>updateJob(j.id,'type',e.target.value)} className="border rounded p-1 w-full">{JOB_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></td><td className="p-3 align-top"><input type="number" value={j.rails} onChange={e=>updateJob(j.id,'rails',e.target.value)} className="border rounded p-1 w-12 text-center"/></td><td className="p-3 align-top"><div className="flex flex-wrap gap-1">{teams.map(t => {
                   // หาพนักงานที่มีสิทธิ์อยู่ในทีมนี้ ในวันที่ทำงานนี้ (รองรับการย้ายทีม)
                   const teamMembersOnDate = allMembers.filter(m => isMemberInTeamOnDate(m, t.id, j.date));
                   if (teamMembersOnDate.length === 0) return null; // ไม่แสดงทีมที่ไม่มีคนในวันนั้น

                   return (
                   <div key={t.id} className="border p-1 rounded bg-white">
                       <div className="font-bold text-[9px] mb-1">{t.name}</div>
                       <div className="flex gap-1 flex-wrap">
                           {teamMembersOnDate.map((m, mIdx) => {
                               const isSelected = (j.selectedTechs || []).includes(m.id);
                               
                               const leave = leaves.find(l => l.techId === m.id && l.date === j.date);
                               const isNoInc = leave?.type === 'no_inc';
                               const isLeave = leave && !isNoInc; // ลาแบบอื่นๆ

                               const isResigned = m.resignDate && j.date >= m.resignDate;
                               const isNotYetJoined = m.joinDate && j.date < m.joinDate;
                               const isDisabled = isLeave || isResigned || isNotYetJoined;

                               return (
                                 <button 
                                   key={`${m.id}-${mIdx}`} 
                                   onClick={() => !isDisabled && toggleTech(j.id, m.id)} 
                                   disabled={isDisabled}
                                   style={isSelected && !isDisabled ? (isNoInc ? {backgroundColor: '#f3e8ff', color: '#7e22ce', borderColor: '#d8b4fe'} : {backgroundColor: themeColor, color: themeTextColor, borderColor: themeColor}) : {}}
                                   className={`px-1.5 py-0.5 rounded text-[9px] border 
                                     ${!isSelected && !isDisabled ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : ''}
                                     ${isLeave ? 'opacity-40 cursor-not-allowed bg-red-100 text-red-400 border-red-200' : ''}
                                     ${isResigned || isNotYetJoined ? 'line-through bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300' : ''}
                                   `}
                                   title={isLeave ? `ลา: ${LEAVE_TYPES.find(lt=>lt.id===leave.type)?.label}` : (isNoInc ? 'ทำงานแต่ไม่คิดเงิน (No Incentive)' : (isResigned ? 'ลาออก/ย้ายทีม แล้ว' : (isNotYetJoined ? 'ยังไม่เริ่มงาน' : '')))}
                                 >
                                   {m.name}
                                 </button>
                               );
                           })}
                       </div>
                   </div>
               )})}</div></td><td className="p-3 text-right align-top font-bold">฿{j.calculatedValue.toLocaleString()}</td><td className="p-3 text-center align-top"><button onClick={()=>toggleJobCheck(j.id, j.isChecked)} className="text-gray-500 hover:text-black">{j.isChecked ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} />}</button></td><td className="p-3 text-center align-top"><div className="flex flex-col items-center"><button onClick={()=>moveJob(j.id, -1, calculatedData.periodJobs)} className="text-gray-400 hover:text-black"><ArrowUp size={12}/></button><button onClick={()=>moveJob(j.id, 1, calculatedData.periodJobs)} className="text-gray-400 hover:text-black"><ArrowDown size={12}/></button></div></td><td className="p-3 text-center align-top"><button onClick={()=>removeJob(j.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div>
             </div>
          )}

          {activeTab === 'teams' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teams.map(t => {
                      const currentTeamMembers = allMembers.filter(m => m.currentTeamId === t.id);
                      
                      return (
                      <div key={t.id} className="bg-white p-4 rounded-xl shadow border relative group">
                          <button onClick={()=>handleDeleteTeam(t.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                          <h3 className="font-bold text-lg mb-2">{t.name} <span className="text-xs font-normal text-gray-500">({currentTeamMembers.length} คน)</span></h3>
                          <ul className="space-y-2 mb-4">
                            {currentTeamMembers.map((m, mIdx) => (
                                <li key={`${m.id}-${mIdx}`} className="flex flex-col text-xs bg-gray-50 p-2 rounded border">
                                    
                                    {transferringMember?.member.id === m.id && transferringMember?.teamId === t.id ? (
                                        <div className="flex-1 space-y-2 bg-blue-50 p-2 rounded border border-blue-100">
                                            <div className="text-xs font-bold text-blue-800 flex items-center gap-1"><ArrowRightLeft size={14}/> ย้าย {m.name} ไปทีมใหม่</div>
                                            <select className="border rounded w-full p-1 text-xs" value={transferringMember.targetTeamId} onChange={e=>setTransferringMember({...transferringMember, targetTeamId: e.target.value})}>
                                                <option value="">-- เลือกทีมปลายทาง --</option>
                                                {teams.filter(team => team.id !== t.id).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                            </select>
                                            <div className="flex gap-1 items-center"><span className="w-16 text-[10px] text-gray-600">วันที่มีผลย้าย:</span><input type="date" className="border rounded p-1 text-xs flex-1" value={transferringMember.date} onChange={e=>setTransferringMember({...transferringMember, date: e.target.value})} /></div>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={handleConfirmTransfer} className="bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-bold w-full hover:bg-blue-700">ยืนยันการย้ายทีม</button>
                                                <button onClick={()=>setTransferringMember(null)} className="bg-gray-300 text-gray-700 px-2 py-1.5 rounded text-xs w-full hover:bg-gray-400">ยกเลิก</button>
                                            </div>
                                        </div>
                                    ) : editingMember?.id === m.id ? (
                                        <div className="flex-1 space-y-2">
                                            <input className="border rounded w-full p-1" value={editingMember.name} onChange={e=>setEditingMember({...editingMember, name:e.target.value})} />
                                            <div className="flex gap-1"><span className="w-8">เริ่ม:</span><input type="date" className="border rounded p-1" value={editingMember.joinDate} onChange={e=>setEditingMember({...editingMember, joinDate:e.target.value})} /></div>
                                            <div className="flex gap-1"><span className="w-8">ออก:</span><input type="date" className="border rounded p-1" value={editingMember.resignDate} onChange={e=>setEditingMember({...editingMember, resignDate:e.target.value})} /></div>
                                            
                                            {/* ประวัติการย้ายทีม */}
                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                <span className="text-[10px] font-bold text-gray-500">ประวัติการสังกัดทีม:</span>
                                                <ul className="mt-1 space-y-1">
                                                    {(editingMember.teamHistory || []).map((history, hIdx) => {
                                                        const hTeam = teams.find(ht => ht.id === history.teamId);
                                                        return (
                                                            <li key={hIdx} className="text-[10px] flex justify-between bg-white p-1 rounded border items-center">
                                                                <span>{hTeam?.name || 'Unknown'} (ตั้งแต่ {formatDate(history.effectiveDate)})</span>
                                                                {hIdx > 0 && <button onClick={() => removeMigrationHistory(m.id, hIdx)} className="text-red-400 hover:text-red-600 px-1">x</button>}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>

                                            <div className="flex gap-2 mt-2 pt-2">
                                                <button onClick={handleUpdateMember} style={{backgroundColor: themeColor, color: themeTextColor}} className="flex-1 px-2 py-1 rounded shadow-sm">บันทึก</button>
                                                <button onClick={()=>setEditingMember(null)} className="bg-gray-200 flex-1 px-2 py-1 rounded shadow-sm">ยกเลิก</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start w-full">
                                            <div>
                                                <div className={`font-medium ${m.resignDate ? 'text-red-500 line-through' : ''}`}>{m.name}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    เริ่ม: {formatDate(m.joinDate)} 
                                                    {m.resignDate && <span className="text-red-500 font-bold ml-1"> (ลาออก: {formatDate(m.resignDate)})</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => setTransferringMember({ teamId: t.id, member: m, targetTeamId: '', date: new Date().toISOString().split('T')[0] })} className="text-orange-400 hover:text-orange-600 p-1 bg-white rounded shadow-sm border" title="ย้ายทีม"><ArrowRightLeft size={12}/></button>
                                                <button onClick={() => setEditingMember(m)} className="text-blue-400 hover:text-blue-600 p-1 bg-white rounded shadow-sm border" title="แก้ไขข้อมูล"><Pencil size={12}/></button>
                                                <button onClick={()=>handleDeleteMember(m.id)} className="text-gray-400 hover:text-red-500 p-1 bg-white rounded shadow-sm border" title="ลบออกจากระบบ"><Trash2 size={12}/></button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                          </ul>
                          {addingMemberTo === t.id ? (<div className="bg-gray-50 p-2 rounded space-y-2"><input placeholder="ชื่อ" className="border w-full p-1 text-xs rounded" value={newMember.name} onChange={e=>setNewMember({...newMember, name:e.target.value})}/><div className="flex gap-1"><span className="text-[10px] w-8 pt-1">เริ่ม:</span><input type="date" className="border w-full p-1 text-xs rounded" value={newMember.joinDate} onChange={e=>setNewMember({...newMember, joinDate:e.target.value})}/></div><div className="flex gap-1"><span className="text-[10px] w-8 pt-1">ออก:</span><input type="date" className="border w-full p-1 text-xs rounded" value={newMember.resignDate} onChange={e=>setNewMember({...newMember, resignDate:e.target.value})}/></div><div className="flex gap-1"><button onClick={()=>handleAddMember(t.id)} style={{backgroundColor: themeColor, color: themeTextColor}} className="w-full rounded text-xs py-1">Save</button><button onClick={()=>setAddingMemberTo(null)} className="bg-gray-200 w-full rounded text-xs py-1">Cancel</button></div></div>) : (<button onClick={()=>{setAddingMemberTo(t.id); setNewMember({name:'',joinDate:new Date().toISOString().split('T')[0], resignDate: ''})}} className="w-full border-2 border-dashed p-2 rounded text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600">+ เพิ่มช่าง</button>)}
                      </div>
                  )})}
// ... existing code ...
                      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left sticky left-0 bg-white p-2 min-w-[100px]">ชื่อ</th>{getDaysArray(period.start, period.end).map(d=><th key={d} className="min-w-[30px] p-1 text-center bg-gray-50 border-b"><div className="text-[8px] text-gray-400">{parseInt(d.split('-')[2])}</div></th>)}</tr></thead>
                      <tbody>
                      {allMembers.map((m, flatIdx) => {
                            const isResigned = m.resignDate && m.resignDate <= period.end;
                            return (
                            <tr key={`${m.id}-${flatIdx}`} className="hover:bg-gray-50">
                                <td className={`py-2 sticky left-0 bg-white border-r font-medium pl-2 ${isResigned ? 'text-gray-400 line-through' : ''}`}>{m.name}</td>
                                {getDaysArray(period.start, period.end).map(d => {
                                    const isResignedOnDate = m.resignDate && m.resignDate <= d; 
                                    const l = leaves.find(x => x.techId === m.id && x.date === d);
                                    const holiday = holidays.includes(d);
                                    const leaveType = l ? LEAVE_TYPES.find(t => t.id === l.type) : null;
                                    
                                    if (isResignedOnDate) {
                                        return <td key={d} className="border text-center bg-gray-100"></td>;
                                    }
                                    
                                    return (
                                        <td 
                                            key={d} 
                                            onClick={(e) => !holiday && openLeaveMenu(e, m.id, d)} 
                                            className={`border text-center cursor-pointer transition-colors ${holiday ? 'bg-red-50' : 'hover:bg-blue-50'} ${leaveType ? leaveType.color : ''}`}>
                                            {leaveType ? leaveType.short : ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        )})}
                      </tbody></table></div>
                  </div>
              </div>
          )}

          {activeTab === 'reports' && (
              <div className="bg-white rounded-xl shadow border overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 no-print">
                      <div className="flex gap-4">
                          <button onClick={() => setReportType('team')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${reportType === 'team' ? 'border-black text-black' : 'border-transparent text-gray-400'}`} style={reportType === 'team' ? {borderColor: themeColor, color: themeColor} : {}}>รายงานแยกตามทีม</button>
                          <button onClick={() => setReportType('tech')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${reportType === 'tech' ? 'border-black text-black' : 'border-transparent text-gray-400'}`} style={reportType === 'tech' ? {borderColor: themeColor, color: themeColor} : {}}>รายงานแยกตามบุคคล</button>
                      </div>
                      <button onClick={() => window.print()} style={{backgroundColor: themeColor, color: themeTextColor}} className="px-4 py-2 rounded flex items-center gap-2 hover:opacity-90"><Printer size={16}/> สั่งพิมพ์ตารางนี้</button>
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
// ... existing code ...
                      {reportType === 'tech' && (
                          <div>
                              <div className="mb-4 flex items-center gap-2 no-print">
                                  <label className="font-bold text-gray-700">เลือกพนักงาน:</label>
                                  <select className="border rounded p-2 text-sm" value={selectedReportTechId} onChange={e=>setSelectedReportTechId(e.target.value)}>
                                      <option value="">-- กรุณาเลือกพนักงาน --</option>
                                      {allMembers.map(m => {
                                          const currentTeam = teams.find(t => t.id === m.currentTeamId)?.name || 'Unknown';
                                          return <option key={m.id} value={m.id}>{m.name} ({currentTeam}) {m.resignDate ? '(ลาออกแล้ว)' : ''}</option>;
                                      })}
                                  </select>
                              </div>

                              {selectedReportTechId && calculatedData.reportTechLogs[selectedReportTechId] && (
                                  <div className="overflow-x-auto print-only-table">
                                      <table className="w-full text-left text-xs border-collapse">
// ... existing code ...