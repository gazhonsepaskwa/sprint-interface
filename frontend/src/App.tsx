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
}

interface Project {
  id: number;
  name: string;
  description?: string;
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
}

type View = 'dashboard' | 'libraries';

function App() {
  const API_BASE = `http://${window.location.hostname}:5001`;

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
  const [syncing, setSyncing] = useState(false);

  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showProjectUpdateModal, setShowProjectUpdateModal] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [updatingProjectIdFor, setUpdatingProjectIdFor] = useState<number | null>(null);

  const [sprintForm, setSprintForm] = useState({ name: '', startDate: '', endDate: '' });
  const [studentForm, setStudentForm] = useState({ name: '', login: '', imageUrl: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [levelForm, setLevelForm] = useState({ text: '', color: '#475569' });
  const [enrollForm, setEnrollForm] = useState({ studentId: 0, projectId: 0 });

  const formatDate = (date: string | Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const fetchData = async () => {
    try {
      const [sprintsRes, studentsRes, projectsRes, levelsRes] = await Promise.all([
        fetch(`${API_BASE}/api/sprints`),
        fetch(`${API_BASE}/api/students`),
        fetch(`${API_BASE}/api/projects`),
        fetch(`${API_BASE}/api/completion-levels`)
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
      const res = await fetch(`${API_BASE}/api/sprints/${selectedSprint.id}/daily?date=${currentDate}`);
      const data = await res.json();
      setDailyData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummaryData = async () => {
    if (!selectedSprint) return;
    try {
      const res = await fetch(`${API_BASE}/api/sprints/${selectedSprint.id}/summary`);
      const data = await res.json();
      setSummaryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
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
    await fetch(`${API_BASE}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

  const sync42Students = async () => {
    if (!confirm('Sync all students from 42 Belgium? This may take a minute.')) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/students/sync-42`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(data.message);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to sync: ' + (err as Error).message);
    } finally {
      setSyncing(false);
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

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE}/api/sprints/${selectedSprint.id}/students/${studentId}`, { method: 'DELETE' });
      await fetchDailyData();
      await fetchSummaryData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSprint = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Permanently delete sprint?')) return;
    await fetch(`${API_BASE}/api/sprints/${id}`, { method: 'DELETE' });
    if (selectedSprint?.id === id) setSelectedSprint(null);
    fetchData();
  };

  const handleDeleteLevel = async (id: number) => {
    if (!confirm('Delete this level?')) return;
    await fetch(`${API_BASE}/api/completion-levels/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Permanently delete this student from library?')) return;
    await fetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDropAllStudents = async () => {
    if (!confirm('DANGER: Permanently delete ALL students from the library and all sprints? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/students`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to drop students');
      await fetchData();
    } catch (err) {
      alert('Error dropping students.');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Permanently delete this project from library?')) return;
    await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updateObjective = async (studentId: number, objective: string, completionLevelId?: number) => {
    if (!selectedSprint) return;
    await fetch(`${API_BASE}/api/objectives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tighter">SPRINT INTERFACE</h1>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <LayoutDashboard size={16} className="inline mr-2" /> DASHBOARD
            </button>
            <button onClick={() => setCurrentView('libraries')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'libraries' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <Settings2 size={16} className="inline mr-2" /> LIBRARIES
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          {currentView === 'dashboard' ? (
             <button onClick={() => { setEditingId(null); setShowSprintModal(true); }} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> NEW SPRINT</button>
          ) : (
            <>
              <div className="relative mr-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search library..."
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs outline-none focus:border-purple-500 transition-all w-[240px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button onClick={() => { setEditingId(null); setStudentForm({name:'', login:'', imageUrl:''}); setShowStudentModal(true); }} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> STUDENT</button>
              <button onClick={() => { setEditingId(null); setProjectForm({name:'', description:''}); setShowProjectModal(true); }} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> PROJECT</button>
              <button onClick={() => { setEditingId(null); setLevelForm({text:'', color:'#475569'}); setShowLevelModal(true); }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> LEVEL</button>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto">
          {currentView === 'dashboard' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-2 space-y-2">
                  <div className="flex items-center gap-2 mb-4 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <Calendar size={14} />
                    <span>Select Sprint</span>
                  </div>
                  {sprints.map(sprint => (
                    <button key={sprint.id} onClick={() => setSelectedSprint(sprint)} className={`w-full text-left p-3 rounded-xl border transition-all group relative ${selectedSprint?.id === sprint.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      <div className="font-bold text-sm truncate pr-6">{sprint.name || `Sprint #${sprint.id}`}</div>
                      <div className="text-[9px] opacity-60 mt-1">{formatDate(sprint.start_date)} / {formatDate(sprint.end_date)}</div>
                      <button onClick={(e) => handleDeleteSprint(e, sprint.id)} className="absolute top-3 right-3 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-10 space-y-8">
                  {selectedSprint ? (
                    <>
                      <section className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <BarChart3 size={16} className="text-amber-500" /> Health Overview
                          </h3>
                          <div className="flex gap-4">
                            {completionLevels.map(level => (
                              <div key={level.id} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: level.color }}></div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">{level.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-950/30">
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase sticky left-0 bg-slate-900 z-10 w-[180px]">Student</th>
                                {getDatesInRange(selectedSprint.start_date, selectedSprint.end_date).map(date => (
                                  <th key={date} className={`px-2 py-3 text-center min-w-[40px] ${date === currentDate ? 'bg-blue-600/10' : ''}`}>
                                    <div className="text-[8px] font-mono text-slate-600">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div className={`text-[10px] font-bold ${date === currentDate ? 'text-blue-400 underline decoration-2' : 'text-slate-500'}`}>{new Date(date).getDate()}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {summaryData.map(student => (
                                <tr key={student.id} className="hover:bg-slate-800/20 transition-colors">
                                  <td className="px-4 py-2 sticky left-0 bg-slate-900 z-10">
                                    <div className="flex items-center gap-3">
                                      <img src={student.image_url} className="w-6 h-6 rounded-lg object-cover" />
                                      <p className="text-[11px] font-bold truncate max-w-[120px]">{student.name}</p>
                                    </div>
                                  </td>
                                  {getDatesInRange(selectedSprint.start_date, selectedSprint.end_date).map(date => {
                                    const color = student.days[date];
                                    return (
                                      <td key={date} className={`p-0 text-center cursor-pointer transition-all border-r border-slate-800/30 ${date === currentDate ? 'ring-2 ring-blue-500 ring-inset z-10 relative' : ''}`} onClick={() => setCurrentDate(date)} style={{ backgroundColor: color || 'transparent' }}>
                                        <div className="h-10 min-w-[40px] flex items-center justify-center">{!color && <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>}</div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xl">
                          <button disabled={isFirstDay} onClick={() => changeDay(-1)} className={`p-2 rounded-lg ${isFirstDay ? 'text-slate-800' : 'text-slate-400 hover:bg-slate-800'}`}><ChevronLeft size={24}/></button>
                          <div className="text-center">
                            <h2 className="text-xl font-bold">{new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{selectedSprint.name || `Sprint #${selectedSprint.id}`}</p>
                          </div>
                          <button disabled={isLastDay} onClick={() => changeDay(1)} className={`p-2 rounded-lg ${isLastDay ? 'text-slate-800' : 'text-slate-400 hover:bg-slate-800'}`}><ChevronRight size={24}/></button>
                        </div>

                        <div className="flex justify-between items-center px-2">
                          <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Sprinters</h3>
                          <button onClick={() => { setEnrollSearch(''); setProjectSearch(''); setEnrollForm({studentId: 0, projectId: 0}); setShowEnrollModal(true); }} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"><UserPlus size={14}/> ENROLL STUDENT</button>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {dailyData.map(student => (
                            <div
                              key={student.student_id}
                              className="border rounded-2xl p-4 flex flex-col gap-4 shadow-lg transition-all relative group"
                              style={{
                                backgroundColor: student.completion_color ? `${student.completion_color}10` : '#0f172a',
                                borderColor: student.completion_color ? `${student.completion_color}30` : '#1e293b'
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <img src={student.image_url} alt={student.name} className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md" />
                                  <div>
                                    <h4 className="font-bold text-sm truncate max-w-[140px] text-slate-100">{student.name}</h4>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 font-mono">{student.login}</span>
                                      <button
                                        onClick={() => { setUpdatingProjectIdFor(student.student_id); setProjectSearch(''); setShowProjectUpdateModal(true); }}
                                        className="text-[10px] font-bold uppercase hover:opacity-70 transition-colors text-left mt-0.5 max-w-[150px] truncate"
                                        style={{ color: student.completion_color || '#a855f7' }}
                                      >
                                        {student.project_name || 'Select Project'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border outline-none cursor-pointer`}
                                    style={{
                                      backgroundColor: student.completion_color ? `${student.completion_color}25` : '#1e293b',
                                      borderColor: student.completion_color ? `${student.completion_color}50` : '#334155',
                                      color: student.completion_color || '#94a3b8'
                                    }}
                                    value={student.completion_level_id || 0}
                                    onChange={(e) => updateObjective(student.student_id, student.objective || '', parseInt(e.target.value))}
                                  >
                                    <option value="0" className="bg-slate-900 text-slate-400">Level</option>
                                    {completionLevels.map(cl => (
                                      <option key={cl.id} value={cl.id} className="bg-slate-900" style={{ color: cl.color }}>{cl.text}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => removeFromSprint(student.student_id)} className="p-2.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"><UserMinus size={18}/></button>
                                </div>
                              </div>
                              <textarea
                                placeholder="Write objective..."
                                className="w-full bg-slate-950/50 border border-slate-800/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all min-h-[80px] text-slate-200"
                                style={student.completion_color && student.completion_text === 'Done' ? { textDecoration: 'line-through', opacity: 0.5, fontStyle: 'italic' } : {}}
                                value={student.objective || ''}
                                onChange={(e) => setDailyData(dailyData.map(d => d.student_id === student.student_id ? {...d, objective: e.target.value} : d))}
                                onBlur={(e) => updateObjective(student.student_id, e.target.value, student.completion_level_id)}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : <div className="h-64 flex flex-col items-center justify-center text-slate-600 italic"><LayoutDashboard className="mb-4 opacity-20" size={64}/><p>Select a sprint.</p></div>}
                </div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <Users className="text-blue-400" size={24} />
                    <h2 className="text-xl font-bold uppercase tracking-widest text-sm text-blue-400">Student Library</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={sync42Students}
                      disabled={syncing}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all border ${syncing ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-blue-600/10 text-blue-400 border-blue-600/30 hover:bg-blue-600/20'}`}
                    >
                      <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
                      {syncing ? 'SYNCING...' : 'SYNC WITH 42 BELGIUM'}
                    </button>
                    <button
                      onClick={handleDropAllStudents}
                      className="bg-rose-600/10 text-rose-500 border border-rose-600/30 hover:bg-rose-600/20 px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2"
                    >
                      <Trash2 size={14} /> DROP ALL
                    </button>
                    <button onClick={() => { setEditingId(null); setStudentForm({name:'', login:'', imageUrl:''}); setShowStudentModal(true); }} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2">
                      <Plus size={16} /> ADD NEW
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {students
                    .filter(s =>
                      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.login.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(student => (
                    <div key={student.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center group hover:border-blue-500 transition-all relative">
                      <img src={student.image_url} className="w-16 h-16 rounded-2xl object-cover mb-3 border-2 border-slate-800 group-hover:border-blue-500 transition-all" />
                      <p className="text-sm font-bold truncate w-full">{student.name}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{student.login}</p>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(student.id); setStudentForm(student); setShowStudentModal(true); }} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg"><Edit3 size={14}/></button>
                        <button onClick={() => handleDeleteStudent(student.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="space-y-8">
                <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                  <h2 className="text-xl font-bold uppercase tracking-widest text-sm mb-8 text-purple-400">Project Library</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects
                      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(project => (
                      <div key={project.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center group hover:border-purple-500 transition-all relative">
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-3 border-2 border-slate-800 group-hover:border-purple-500 transition-all"><Briefcase size={24} className="text-slate-500"/></div>
                        <p className="text-sm font-bold truncate w-full">{project.name}</p>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(project.id); setProjectForm(project); setShowProjectModal(true); }} className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg"><Edit3 size={14}/></button>
                          <button onClick={() => handleDeleteProject(project.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                  <h2 className="text-xl font-bold uppercase tracking-widest text-sm mb-8 text-amber-400">Completion Levels</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {completionLevels.map(level => (
                      <div key={level.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center relative group">
                        <div className="w-8 h-8 rounded-full mb-3" style={{ backgroundColor: level.color }}></div>
                        <p className="text-xs font-bold truncate w-full" style={{ color: level.color }}>{level.text}</p>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(level.id); setLevelForm(level); setShowLevelModal(true); }} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg"><Edit3 size={12}/></button>
                          <button onClick={() => handleDeleteLevel(level.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-blue-400">New Sprint</h2>
              <button onClick={() => setShowSprintModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateSprint} className="space-y-4">
              <input type="text" placeholder="Name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500" onChange={e => setSprintForm({...sprintForm, name: e.target.value})}/>
              <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500" onChange={e => setSprintForm({...sprintForm, startDate: e.target.value})}/>
              <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500" onChange={e => setSprintForm({...sprintForm, endDate: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowSprintModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 rounded-xl font-bold">Create</button>
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-emerald-400">{editingId ? 'Edit' : 'Add'} Student</h2>
              <button onClick={() => { setShowStudentModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <input type="text" placeholder="Full Name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-emerald-500" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})}/><input type="text" placeholder="Login" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-emerald-500" value={studentForm.login} onChange={e => setStudentForm({...studentForm, login: e.target.value})}/><input type="url" placeholder="Image URL" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-emerald-500" value={studentForm.imageUrl} onChange={e => setStudentForm({...studentForm, imageUrl: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowStudentModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 rounded-xl font-bold">Save</button>
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400">{editingId ? 'Edit' : 'New'} Project</h2>
              <button onClick={() => { setShowProjectModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="space-y-4">
              <input type="text" placeholder="Project Name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-purple-500" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})}/><textarea placeholder="Description" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 min-h-[100px] outline-none focus:border-purple-500" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowProjectModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">Save</button>
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold mb-6 text-amber-400">{editingId ? 'Edit' : 'New'} Level</h2>
              <button onClick={() => { setShowLevelModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleLevelSubmit} className="space-y-4">
              <input type="text" placeholder="Text" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-amber-500" value={levelForm.text} onChange={e => setLevelForm({...levelForm, text: e.target.value})}/><input type="color" className="w-full h-10 cursor-pointer" value={levelForm.color} onChange={e => setLevelForm({...levelForm, color: e.target.value})}/>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => { setShowLevelModal(false); setEditingId(null); }} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-amber-600 rounded-xl font-bold">Save</button>
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Enroll in {selectedSprint?.name || 'Sprint'}</h2>
              <button onClick={() => setShowEnrollModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-8">
              {/* Student Selection Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">1. Select Student</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-[10px] outline-none focus:border-blue-500 transition-all w-[150px]"
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
                            ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <img src={student.image_url} className="w-10 h-10 rounded-lg object-cover shadow-md" alt="" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{student.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{student.login}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Project Selection Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">2. Assign Project</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter projects..."
                      className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-[10px] outline-none focus:border-purple-500 transition-all w-[150px]"
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
                            ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${enrollForm.projectId === project.id ? 'bg-purple-600/30' : 'bg-slate-900'}`}>
                          <Briefcase size={18} className={enrollForm.projectId === project.id ? 'text-purple-400' : 'text-slate-600'} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{project.name}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors text-sm uppercase tracking-widest">Cancel</button>
                <button
                  onClick={() => enrollOrUpdateStudent(enrollForm.studentId, enrollForm.projectId, true)}
                  disabled={enrollForm.studentId === 0 || enrollForm.projectId === 0}
                  className="flex-[2] py-4 bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-black transition-all shadow-lg shadow-emerald-900/20 uppercase tracking-widest"
                >
                  Confirm Enrollment
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
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                  <Briefcase className="text-purple-400" />
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-purple-500 transition-all"
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
                    className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-purple-500 hover:bg-purple-600/10 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center group-hover:bg-purple-600/30 transition-all">
                      <Briefcase size={18} className="text-slate-600 group-hover:text-purple-400" />
                    </div>
                    <p className="text-sm font-bold truncate">{project.name}</p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
