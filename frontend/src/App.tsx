import { useEffect, useState } from 'react'
import { Plus, Calendar, UserPlus, Users, Briefcase, ChevronRight, Trash2, ChevronLeft, CheckCircle2, Circle, LayoutDashboard, Settings2, UserMinus, Palette, BarChart3, Edit3, RefreshCcw, Search, X } from 'lucide-react'

interface Sprint {
  id: number;
  name?: string;
  start_date: string;
  end_date: string;
}

interface Student {
  id: number;
  name: string;
  login: string;
  image_url: string;
  usage_count?: number;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  usage_count?: number;
}

interface CompletionLevel {
  id: number;
  text: string;
  color: string;
}

interface DailyData {
  student_id: number;
  name: string;
  login: string;
  image_url: string;
  project_id?: number;
  project_name?: string;
  objective_id?: number;
  objective?: string;
  is_done?: boolean;
  completion_level_id?: number;
  completion_text?: string;
  completion_color?: string;
}

interface SprintSummaryStudent {
  id: number;
  name: string;
  login: string;
  image_url: string;
  days: { [date: string]: string };
  sprint_goal?: string;
  is_goal_met?: boolean;
}

interface User {
  id: number;
  login: string;
  name: string;
  image_url: string;
  is_staff: boolean;
}

type View = 'dashboard' | 'libraries';

function App() {
  const API_BASE = `http://${window.location.hostname}:5001`;

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [completionLevels, setCompletionLevels] = useState<CompletionLevel[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [summaryData, setSummaryData] = useState<SprintSummaryStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [syncingStudents, setSyncingStudents] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);

  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showProjectUpdateModal, setShowProjectUpdateModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [updatingProjectIdFor, setUpdatingProjectIdFor] = useState<number | null>(null);

  const [sprintForm, setSprintForm] = useState({ name: '', startDate: '', endDate: '' });
  const [studentForm, setStudentForm] = useState({ name: '', login: '', imageUrl: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [levelForm, setLevelForm] = useState({ text: '', color: '#475569' });
  const [enrollForm, setEnrollForm] = useState({ studentId: 0, projectId: 0 });
  const [goalForm, setGoalForm] = useState({ studentId: 0, studentName: '', goal: '', isMet: false });

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  const checkAuth = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/auth/me`);
      const userData = await res.json();
      setUser(userData);
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogin = () => {
    window.location.href = `${API_BASE}/api/auth/42`;
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
      await apiFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const fetchData = async () => {
    try {
      const [sprintsRes, studentsRes, projectsRes, levelsRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/sprints`),
        apiFetch(`${API_BASE}/api/students`),
        apiFetch(`${API_BASE}/api/projects`),
        apiFetch(`${API_BASE}/api/completion-levels`)
      ]);
      const sprintsData = await sprintsRes.json();
      const studentsData = await studentsRes.json();
      const projectsData = await projectsRes.json();
      const levelsData = await levelsRes.json();

      setSprints(Array.isArray(sprintsData) ? sprintsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setCompletionLevels(Array.isArray(levelsData) ? levelsData : []);

      if (!selectedSprint && sprintsData.length > 0) {
        const firstSprint = sprintsData[0];
        setSelectedSprint(firstSprint);
        setCurrentDate(formatDate(firstSprint.start_date));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const fetchDailyData = async () => {
    if (!selectedSprint) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/sprints/${selectedSprint.id}/daily?date=${currentDate}`);
      const data = await res.json();
      setDailyData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummaryData = async () => {
    if (!selectedSprint) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/sprints/${selectedSprint.id}/summary`);
      const data = await res.json();
      setSummaryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSprint && currentView === 'dashboard') {
      const start = formatDate(selectedSprint.start_date);
      const end = formatDate(selectedSprint.end_date);
      if (currentDate < start) setCurrentDate(start);
      else if (currentDate > end) setCurrentDate(end);
      else {
        fetchDailyData();
        fetchSummaryData();
      }
    }
  }, [selectedSprint, currentDate, currentView]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch(`${API_BASE}/api/sprints`, {
      method: 'POST',
      body: JSON.stringify(sprintForm),
    });
    setShowSprintModal(false);
    fetchData();
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/api/students/${editingId}` : `${API_BASE}/api/students`;
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(studentForm),
      });
      if (!res.ok) throw new Error('Failed to save student');
      setShowStudentModal(false);
      setEditingId(null);
      setStudentForm({ name: '', login: '', imageUrl: '' });
      await fetchData();
    } catch (err) {
      alert('Error saving student.');
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/api/projects/${editingId}` : `${API_BASE}/api/projects`;
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(projectForm),
      });
      if (!res.ok) throw new Error('Failed to save project');
      setShowProjectModal(false);
      setEditingId(null);
      setProjectForm({ name: '', description: '' });
      await fetchData();
    } catch (err) {
      alert('Error saving project.');
    }
  };

  const handleLevelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/api/completion-levels/${editingId}` : `${API_BASE}/api/completion-levels`;
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(levelForm),
      });
      if (!res.ok) throw new Error('Failed to save level');
      setShowLevelModal(false);
      setEditingId(null);
      setLevelForm({ text: '', color: '#475569' });
      await fetchData();
    } catch (err) {
      alert('Error saving level.');
    }
  };

  const sync42Projects = async () => {
    if (!confirm('Sync projects from 42 Cursus? This will fetch standard curriculum projects.')) return;
    setSyncingProjects(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/projects/sync-42`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(data.message);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to sync projects.');
    } finally {
      setSyncingProjects(false);
    }
  };

  const sync42Students = async () => {
    if (!confirm('Sync all students from 42 Belgium? This may take a minute.')) return;
    setSyncingStudents(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/students/sync-42`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(data.message);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to sync: ' + (err as Error).message);
    } finally {
      setSyncingStudents(false);
    }
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSprint) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/sprints/${selectedSprint.id}/students/${goalForm.studentId}/goal`, {
        method: 'POST',
        body: JSON.stringify({ goal: goalForm.goal, isMet: goalForm.isMet }),
      });
      if (!res.ok) throw new Error('Failed to update goal');
      setShowGoalModal(false);
      fetchSummaryData();
    } catch (err) {
      alert('Error updating goal');
    }
  };

  const enrollOrUpdateStudent = async (studentId: number, projectId: number, isModal = false) => {
    if (!selectedSprint || studentId === 0 || projectId === 0) return;
    try {
      const url = isModal
        ? `${API_BASE}/api/sprints/${selectedSprint.id}/students`
        : `${API_BASE}/api/sprints/${selectedSprint.id}/students/${studentId}/project`;

      const body = isModal
        ? { studentId, projectId }
        : { projectId, date: currentDate };

      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Action failed');

      if (isModal) {
        setShowEnrollModal(false);
        setEnrollForm({ studentId: 0, projectId: 0 });
      }
      await fetchDailyData();
      await fetchSummaryData();
    } catch (err) {
      console.error(err);
      alert('Failed to save assignment.');
    }
  };

  const removeFromSprint = async (studentId: number) => {
    if (!selectedSprint || !confirm('Remove from sprint?')) return;
    try {
      await apiFetch(`${API_BASE}/api/sprints/${selectedSprint.id}/students/${studentId}`, { method: 'DELETE' });
      await fetchDailyData();
      await fetchSummaryData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSprint = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Permanently delete sprint?')) return;
    await apiFetch(`${API_BASE}/api/sprints/${id}`, { method: 'DELETE' });
    if (selectedSprint?.id === id) setSelectedSprint(null);
    fetchData();
  };

  const handleDeleteLevel = async (id: number) => {
    if (!confirm('Delete this level?')) return;
    await apiFetch(`${API_BASE}/api/completion-levels/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Permanently delete this student from library?')) return;
    await apiFetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDropAllStudents = async () => {
    if (!confirm('DANGER: Permanently delete ALL students from the library and all sprints? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/students`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to drop students');
      await fetchData();
    } catch (err) {
      alert('Error dropping students.');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Permanently delete this project from library?')) return;
    await apiFetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updateObjective = async (studentId: number, objective: string, completionLevelId?: number) => {
    if (!selectedSprint) return;
    await apiFetch(`${API_BASE}/api/objectives`, {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        sprintId: selectedSprint.id,
        date: currentDate,
        objective,
        completionLevelId
      }),
    });
    await fetchDailyData();
    await fetchSummaryData();
  };

  const changeDay = (days: number) => {
    if (!selectedSprint) return;
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(formatDate(d));
  };

  const getDatesInRange = (startDate: string, endDate: string) => {
    const dates = [];
    let current = new Date(startDate);
    const last = new Date(endDate);
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const isFirstDay = selectedSprint && currentDate <= formatDate(selectedSprint.start_date);
  const isLastDay = selectedSprint && currentDate >= formatDate(selectedSprint.end_date);

  const closeAllModals = () => {
    setShowSprintModal(false);
    setShowStudentModal(false);
    setShowProjectModal(false);
    setShowLevelModal(false);
    setShowEnrollModal(false);
    setShowProjectUpdateModal(false);
    setEditingId(null);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans flex flex-col">
      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="flex items-center gap-4 mb-12">
            <span className="text-primary text-8xl font-bold tracking-tighter">42</span>
            <div className="flex flex-col leading-none">
              <span className="text-3xl font-bold uppercase tracking-tight">Sprint</span>
              <span className="text-3xl font-bold uppercase tracking-tight">Platform</span>
            </div>
          </div>
          <div className="bg-card border border-border p-12 rounded-3xl shadow-2xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-4">Welcome back</h2>
            <p className="text-slate-400 mb-8">Sign in with your Intra 42 account to manage sprints and track progress.</p>
            <button
              onClick={handleLogin}
              className="w-full py-4 bg-primary hover:bg-opacity-90 rounded-2xl font-black text-lg transition-all shadow-lg flex items-center justify-center gap-3"
            >
              LOGIN WITH INTRA
            </button>
          </div>
        </div>
      ) : (
        <>
          <nav className="px-10 py-6 flex justify-between items-center sticky top-0 z-30 bg-background/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-primary text-5xl font-bold tracking-tighter">42</span>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold uppercase tracking-tight">Sprint</span>
                <span className="text-xl font-bold uppercase tracking-tight">Platform</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={() => setCurrentView('dashboard')} className={`text-sm font-medium hover:text-white transition-colors ${currentView === 'dashboard' ? 'text-white' : 'text-slate-400'}`}>Dashboard</button>
              <button onClick={() => setCurrentView('libraries')} className={`text-sm font-medium hover:text-white transition-colors ${currentView === 'libraries' ? 'text-white' : 'text-slate-400'}`}>Libraries</button>
              <div className="flex items-center gap-4 ml-4 group relative">
                <div className="flex items-center gap-3 cursor-pointer" onClick={handleLogout}>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold">{user.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{user.login}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary">
                    <img src={user.image_url} alt="Profile" />
                  </div>
                </div>
              </div>
            </div>
          </nav>


          <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto">
          {currentView === 'dashboard' ? (
             <div className="space-y-8">
                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Select Sprint Card */}
                  <div className="tutor-card lg:col-span-1">
                    <div className="flex items-center gap-3 mb-6">
                      <Calendar className="text-primary" size={24} />
                      <h2 className="text-xl font-bold">Select Sprint</h2>
                    </div>
                    <div className="space-y-2">
                      {sprints.map(sprint => (
                        <button key={sprint.id} onClick={() => setSelectedSprint(sprint)} className={`w-full text-left p-4 rounded-lg border transition-all group relative ${selectedSprint?.id === sprint.id ? 'bg-primary/10 border-primary text-primary' : 'bg-[#1c2333] border-border text-slate-400 hover:border-slate-500'}`}>
                          <div className="font-bold text-sm truncate pr-6">{sprint.name || `Sprint #${sprint.id}`}</div>
                          <div className="text-[10px] opacity-60 mt-1">{formatDate(sprint.start_date)} / {formatDate(sprint.end_date)}</div>
                          <button onClick={(e) => handleDeleteSprint(e, sprint.id)} className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                        </button>
                      ))}
                      <button onClick={() => { setEditingId(null); setShowSprintModal(true); }} className="w-full mt-4 tutor-button-primary">
                        <Plus size={18} /> New Sprint
                      </button>
                    </div>
                  </div>

                  {/* Health Overview / Summary Card */}
                  <div className="tutor-card lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="text-rose-500" size={24} />
                        <h2 className="text-xl font-bold">Health Overview</h2>
                      </div>
                      <div className="flex gap-4">
                        {completionLevels.map(level => (
                          <div key={level.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: level.color }}></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{level.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedSprint ? (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#1c2333]">
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase sticky left-0 bg-[#1c2333] z-10 w-[180px]">Student</th>
                              {getDatesInRange(selectedSprint.start_date, selectedSprint.end_date).map(date => (
                                <th key={date} className={`px-2 py-3 text-center min-w-[40px] transition-all relative ${date === currentDate ? 'bg-primary/10 border-x border-primary z-20' : 'border-x border-border/50'}`}>
                                  <div className="text-[8px] font-mono text-slate-600">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                  <div className={`text-[10px] font-bold ${date === currentDate ? 'text-primary' : 'text-slate-500'}`}>{new Date(date).getDate()}</div>
                                </th>
                              ))}
                              <th className="px-6 py-3 text-[10px] font-bold text-primary uppercase tracking-widest border-l border-border bg-[#1c2333]">Goal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {summaryData.map((student, sIdx) => (
                              <tr key={student.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-4 py-3 sticky left-0 bg-card z-10">
                                  <div className="flex items-center gap-3">
                                    <img src={student.image_url} className="w-6 h-6 rounded-md object-cover" />
                                    <p className="text-[11px] font-bold truncate max-w-[120px]">{student.name}</p>
                                  </div>
                                </td>
                                {getDatesInRange(selectedSprint.start_date, selectedSprint.end_date).map(date => {
                                  const color = student.days[date];
                                  return (
                                    <td
                                      key={date}
                                      className={`p-0 text-center cursor-pointer transition-all relative ${date === currentDate ? `bg-primary/10 border-x border-primary z-20` : 'border-x border-border/10'}`}
                                      onClick={() => setCurrentDate(date)}
                                      style={{ backgroundColor: color || undefined }}
                                    >
                                      <div className="h-10 min-w-[40px] flex items-center justify-center">{!color && <div className="w-1 h-1 rounded-full bg-border"></div>}</div>
                                    </td>
                                  );
                                })}
                                <td
                                  className={`p-0 text-center cursor-pointer transition-all border-l border-border relative group/goal`}
                                  style={{ backgroundColor: student.is_goal_met ? '#10b98115' : 'transparent' }}
                                  onClick={() => {
                                    setGoalForm({ studentId: student.id, studentName: student.name, goal: student.sprint_goal || '', isMet: student.is_goal_met || false });
                                    setShowGoalModal(true);
                                  }}
                                >
                                  <div className="h-10 px-4 flex items-center justify-start gap-3 overflow-hidden min-w-[150px]">
                                    {student.is_goal_met ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <Circle size={14} className="text-slate-700 shrink-0" />}
                                    <span className={`text-[10px] font-black truncate uppercase tracking-tight ${student.is_goal_met ? 'text-emerald-400' : student.sprint_goal ? 'text-slate-300' : 'text-slate-700'}`}>
                                      {student.sprint_goal || 'SET GOAL'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-600 italic">
                        <BarChart3 className="mb-4 opacity-10" size={64}/>
                        <p>Select a sprint to see health overview.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Day Selector Card */}
                {selectedSprint && (
                  <div className="tutor-card">
                    <div className="flex items-center justify-between">
                      <button disabled={isFirstDay} onClick={() => changeDay(-1)} className={`p-2 rounded-lg ${isFirstDay ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-800'}`}><ChevronLeft size={32}/></button>
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                        <p className="text-sm text-primary font-bold uppercase tracking-widest">{selectedSprint.name || `Sprint #${selectedSprint.id}`}</p>
                      </div>
                      <button disabled={isLastDay} onClick={() => changeDay(1)} className={`p-2 rounded-lg ${isLastDay ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-800'}`}><ChevronRight size={32}/></button>
                    </div>
                  </div>
                )}

                {/* Sprinters Card */}
                {selectedSprint && (
                  <div className="tutor-card">
                    <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center gap-3">
                        <Users className="text-primary" size={24} />
                        <h2 className="text-xl font-bold">Sprinters</h2>
                      </div>
                      <button onClick={() => { setEnrollSearch(''); setProjectSearch(''); setEnrollForm({studentId: 0, projectId: 0}); setShowEnrollModal(true); }} className="tutor-button-primary">
                        <UserPlus size={18}/> Add Sprinter
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dailyData.map(student => (
                        <div
                          key={student.student_id}
                          className="bg-[#1c2333] border border-border rounded-xl p-6 flex flex-col gap-4 shadow-sm transition-all relative group hover:border-primary/50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <img src={student.image_url} alt={student.name} className="w-16 h-16 rounded-xl object-cover border-2 border-border shadow-md" />
                              <div className="min-w-0">
                                <h4 className="font-bold text-lg truncate text-slate-100">{student.name}</h4>
                                <p className="text-xs text-slate-500 font-mono mb-2">{student.login}</p>
                                <button
                                  onClick={() => { setUpdatingProjectIdFor(student.student_id); setProjectSearch(''); setShowProjectUpdateModal(true); }}
                                  className="text-[11px] font-bold uppercase px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-full"
                                >
                                  {student.project_name || 'Select Project'}
                                </button>
                              </div>
                            </div>
                            <button onClick={() => removeFromSprint(student.student_id)} className="text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Today's Objective</label>
                            <textarea
                              placeholder="What is the objective for today?"
                              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all min-h-[100px] text-slate-200"
                              style={student.completion_color && student.completion_text === 'Done' ? { textDecoration: 'line-through', opacity: 0.5, fontStyle: 'italic' } : {}}
                              value={student.objective || ''}
                              onChange={(e) => setDailyData(dailyData.map(d => d.student_id === student.student_id ? {...d, objective: e.target.value} : d))}
                              onBlur={(e) => updateObjective(student.student_id, e.target.value, student.completion_level_id)}
                            />
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/30">
                            <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                            <select
                              className="bg-card border border-border rounded px-3 py-1.5 text-xs font-bold uppercase outline-none cursor-pointer focus:border-primary"
                              style={{ color: student.completion_color || '#94a3b8' }}
                              value={student.completion_level_id || 0}
                              onChange={(e) => updateObjective(student.student_id, student.objective || '', parseInt(e.target.value))}
                            >
                              <option value="0" className="bg-[#1c2333] text-slate-400">Not Started</option>
                              {completionLevels.map(cl => (
                                <option key={cl.id} value={cl.id} className="bg-[#1c2333]" style={{ color: cl.color }}>{cl.text}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          ) : (
            <div className="space-y-8">
              <div className="max-w-md mx-auto">
                <div className="relative">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search all libraries..."
                    className="w-full tutor-input pl-12 py-3 text-lg shadow-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Student Library Card */}
                <div className="tutor-card h-fit">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <Users className="text-primary" size={24} />
                      <h2 className="text-xl font-bold uppercase tracking-tight">Students</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={sync42Students}
                        disabled={syncingStudents}
                        className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-xs transition-all border ${syncingStudents ? 'bg-slate-800 text-slate-500 border-border cursor-not-allowed opacity-50' : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
                      >
                        <RefreshCcw size={14} className={syncingStudents ? 'animate-spin' : ''} />
                        SYNC
                      </button>
                      <button onClick={() => { setEditingId(null); setStudentForm({name:'', login:'', imageUrl:''}); setShowStudentModal(true); }} className="tutor-button-primary text-xs p-2">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {students
                      .filter(s => {
                        if (searchTerm === '') return (s.usage_count || 0) > 0;
                        return (
                          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.login.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                      })
                      .slice(0, searchTerm === '' ? 12 : undefined)
                      .map(student => (
                      <div key={student.id} className="bg-[#1c2333] border border-border rounded-xl p-4 flex flex-col items-center text-center group hover:border-primary transition-all relative">
                        <img src={student.image_url} className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-border group-hover:border-primary transition-all" />
                        <p className="text-xs font-bold truncate w-full">{student.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{student.login}</p>
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(student.id); setStudentForm(student); setShowStudentModal(true); }} className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg"><Edit3 size={12}/></button>
                          <button onClick={() => handleDeleteStudent(student.id)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project Library Card */}
                <div className="tutor-card h-fit">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <Briefcase className="text-secondary" size={24} />
                      <h2 className="text-xl font-bold uppercase tracking-tight">Projects</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={sync42Projects}
                        disabled={syncingProjects}
                        className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-xs transition-all border ${syncingProjects ? 'bg-slate-800 text-slate-500 border-border cursor-not-allowed opacity-50' : 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20'}`}
                      >
                        <RefreshCcw size={14} className={syncingProjects ? 'animate-spin' : ''} />
                        SYNC
                      </button>
                      <button onClick={() => { setEditingId(null); setProjectForm({name:'', description:''}); setShowProjectModal(true); }} className="bg-secondary hover:bg-opacity-90 text-white font-bold p-2 rounded transition-all flex items-center justify-center gap-2 text-xs">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {projects
                      .filter(p => {
                        if (searchTerm === '') return (p.usage_count || 0) > 0;
                        return p.name.toLowerCase().includes(searchTerm.toLowerCase());
                      })
                      .slice(0, searchTerm === '' ? 9 : undefined)
                      .map(project => (
                      <div key={project.id} className="bg-[#1c2333] border border-border rounded-xl p-4 flex flex-col items-center text-center group hover:border-secondary transition-all relative">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-4 border border-secondary/20 group-hover:border-secondary transition-all">
                          <Briefcase size={20} className="text-secondary"/>
                        </div>
                        <p className="text-xs font-bold truncate w-full">{project.name}</p>
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(project.id); setProjectForm(project); setShowProjectModal(true); }} className="p-1 text-slate-400 hover:text-secondary hover:bg-secondary/10 rounded-lg"><Edit3 size={12}/></button>
                          <button onClick={() => handleDeleteProject(project.id)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Levels Card */}
                <div className="tutor-card h-fit">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <Palette className="text-amber-500" size={24} />
                      <h2 className="text-xl font-bold uppercase tracking-tight">Levels</h2>
                    </div>
                    <button onClick={() => { setEditingId(null); setLevelForm({text:'', color:'#475569'}); setShowLevelModal(true); }} className="bg-amber-500 hover:bg-opacity-90 text-white font-bold p-2 rounded transition-all flex items-center justify-center gap-2 text-xs">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {completionLevels.map(level => (
                      <div key={level.id} className="bg-[#1c2333] border border-border rounded-xl p-4 flex flex-col items-center text-center relative group hover:border-amber-500 transition-all">
                        <div className="w-8 h-8 rounded-full mb-3 shadow-md" style={{ backgroundColor: level.color }}></div>
                        <p className="text-xs font-bold uppercase" style={{ color: level.color }}>{level.text}</p>
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(level.id); setLevelForm(level); setShowLevelModal(true); }} className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg"><Edit3 size={10}/></button>
                          <button onClick={() => handleDeleteLevel(level.id)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={10}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showSprintModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-primary">New Sprint</h2>
              <button onClick={() => setShowSprintModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateSprint} className="space-y-4">
              <input type="text" placeholder="Name" className="w-full tutor-input" onChange={e => setSprintForm({...sprintForm, name: e.target.value})}/>
              <input type="date" required className="w-full tutor-input" onChange={e => setSprintForm({...sprintForm, startDate: e.target.value})}/>
              <input type="date" required className="w-full tutor-input" onChange={e => setSprintForm({...sprintForm, endDate: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowSprintModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 tutor-button-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStudentModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-primary">{editingId ? 'Edit' : 'Add'} Student</h2>
              <button onClick={() => { setShowStudentModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <input type="text" placeholder="Full Name" required className="w-full tutor-input" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})}/>
              <input type="text" placeholder="Login" required className="w-full tutor-input" value={studentForm.login} onChange={e => setStudentForm({...studentForm, login: e.target.value})}/>
              <input type="url" placeholder="Image URL" required className="w-full tutor-input" value={studentForm.imageUrl} onChange={e => setStudentForm({...studentForm, imageUrl: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowStudentModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 tutor-button-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProjectModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-secondary">{editingId ? 'Edit' : 'New'} Project</h2>
              <button onClick={() => { setShowProjectModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="space-y-4">
              <input type="text" placeholder="Project Name" required className="w-full tutor-input" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})}/>
              <textarea placeholder="Description" className="w-full tutor-input min-h-[100px]" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowProjectModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-secondary text-white font-bold py-3 rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLevelModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold mb-6 text-amber-500">{editingId ? 'Edit' : 'New'} Level</h2>
              <button onClick={() => { setShowLevelModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleLevelSubmit} className="space-y-4">
              <input type="text" placeholder="Text" required className="w-full tutor-input" value={levelForm.text} onChange={e => setLevelForm({...levelForm, text: e.target.value})}/>
              <input type="color" className="w-full h-10 cursor-pointer rounded overflow-hidden" value={levelForm.color} onChange={e => setLevelForm({...levelForm, color: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowLevelModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-amber-500 text-white font-bold py-3 rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEnrollModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Add Sprinter to {selectedSprint?.name || 'Sprint'}</h2>
              <button onClick={() => setShowEnrollModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-8">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">1. Select Student</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="tutor-input pl-10 py-1.5 text-xs w-[180px]"
                      value={enrollSearch}
                      onChange={(e) => setEnrollSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {students
                    .filter(s =>
                      s.name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
                      s.login.toLowerCase().includes(enrollSearch.toLowerCase())
                    )
                    .map(student => (
                      <button
                        key={student.id}
                        onClick={() => setEnrollForm({...enrollForm, studentId: student.id})}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          enrollForm.studentId === student.id
                            ? 'bg-primary/20 border-primary shadow-sm'
                            : 'bg-[#1c2333] border-border hover:border-slate-500'
                        }`}
                      >
                        <img src={student.image_url} className="w-10 h-10 rounded-full object-cover border border-border shadow-md" alt="" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{student.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{student.login}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">2. Assign Project</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter projects..."
                      className="tutor-input pl-10 py-1.5 text-xs w-[180px]"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {projects
                    .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                    .map(project => (
                      <button
                        key={project.id}
                        onClick={() => setEnrollForm({...enrollForm, projectId: project.id})}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          enrollForm.projectId === project.id
                            ? 'bg-secondary/20 border-secondary shadow-sm'
                            : 'bg-[#1c2333] border-border hover:border-slate-500'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${enrollForm.projectId === project.id ? 'bg-secondary/30' : 'bg-card'}`}>
                          <Briefcase size={18} className={enrollForm.projectId === project.id ? 'text-secondary' : 'text-slate-600'} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{project.name}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={() => enrollOrUpdateStudent(enrollForm.studentId, enrollForm.projectId, true)}
                  disabled={enrollForm.studentId === 0 || enrollForm.projectId === 0}
                  className="flex-[2] py-4 bg-primary disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold transition-all shadow-lg"
                >
                  Confirm Sprinter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjectUpdateModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center border border-secondary/30">
                  <Briefcase className="text-secondary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Update Project</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">From {currentDate} onwards</p>
                </div>
              </div>
              <button onClick={() => setShowProjectUpdateModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter projects by name..."
                className="w-full tutor-input pl-12"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {projects
                .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                .map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      if (updatingProjectIdFor) {
                        enrollOrUpdateStudent(updatingProjectIdFor, project.id, false);
                        setShowProjectUpdateModal(false);
                      }
                    }}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-[#1c2333] hover:border-secondary hover:bg-secondary/10 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center group-hover:bg-secondary/30 transition-all">
                      <Briefcase size={18} className="text-slate-600 group-hover:text-secondary" />
                    </div>
                    <p className="text-sm font-bold truncate">{project.name}</p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }}
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-primary tracking-tight">Sprint Goal</h2>
                <p className="text-xs text-slate-500 font-bold uppercase">{goalForm.studentName}</p>
              </div>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Goal Description</label>
                <textarea
                  required
                  placeholder="e.g. Finish all mandatory tasks"
                  className="w-full tutor-input min-h-[120px]"
                  value={goalForm.goal}
                  onChange={e => setGoalForm({...goalForm, goal: e.target.value})}
                />
              </div>

              <div
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group ${goalForm.isMet ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-[#1c2333] border-border hover:border-slate-500'}`}
                onClick={() => setGoalForm({...goalForm, isMet: !goalForm.isMet})}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${goalForm.isMet ? 'bg-emerald-500 text-white' : 'bg-card text-slate-500'}`}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${goalForm.isMet ? 'text-emerald-400' : 'text-slate-400'}`}>Goal Met</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowGoalModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-primary hover:bg-opacity-90 rounded-xl font-bold transition-all shadow-lg">Save Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default App
