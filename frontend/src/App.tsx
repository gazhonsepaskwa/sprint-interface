import { useEffect, useState } from 'react'
import { Plus, Calendar, UserPlus, Users, Briefcase, ChevronRight, Trash2, ChevronLeft, CheckCircle2, Circle, LayoutDashboard, Settings2, UserMinus } from 'lucide-react'

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
}

type View = 'dashboard' | 'libraries';

function App() {
  const API_BASE = `http://${window.location.hostname}:5001`;

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);

  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const [sprintForm, setSprintForm] = useState({ name: '', startDate: '', endDate: '' });
  const [studentForm, setStudentForm] = useState({ name: '', login: '', imageUrl: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [enrollForm, setEnrollForm] = useState({ studentId: 0, projectId: 0 });

  const formatDate = (date: string | Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const fetchData = async () => {
    try {
      const [sprintsRes, studentsRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/api/sprints`),
        fetch(`${API_BASE}/api/students`),
        fetch(`${API_BASE}/api/projects`)
      ]);
      const sprintsData = await sprintsRes.json();
      const studentsData = await studentsRes.json();
      const projectsData = await projectsRes.json();

      setSprints(Array.isArray(sprintsData) ? sprintsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSprint) {
      const start = formatDate(selectedSprint.start_date);
      const end = formatDate(selectedSprint.end_date);
      if (currentDate < start) setCurrentDate(start);
      else if (currentDate > end) setCurrentDate(end);
      else fetchDailyData();
    }
  }, [selectedSprint, currentDate]);

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

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm),
      });
      if (!res.ok) throw new Error('Failed to add student');
      setShowStudentModal(false);
      setStudentForm({ name: '', login: '', imageUrl: '' });
      await fetchData();
    } catch (err) {
      alert('Failed to add student.');
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });
      if (!res.ok) throw new Error('Failed to add project');
      setShowProjectModal(false);
      setProjectForm({ name: '', description: '' });
      await fetchData();
    } catch (err) {
      alert('Failed to add project.');
      console.error(err);
    }
  };

  const enrollOrUpdateStudent = async (studentId: number, projectId: number, isModal = false) => {
    if (!selectedSprint || studentId === 0 || projectId === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/sprints/${selectedSprint.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, projectId }),
      });
      if (!res.ok) throw new Error('Action failed');

      if (isModal) {
        setShowEnrollModal(false);
        setEnrollForm({ studentId: 0, projectId: 0 });
      }
      await fetchDailyData();
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

  const updateObjective = async (studentId: number, objective: string, isDone: boolean) => {
    if (!selectedSprint) return;
    await fetch(`${API_BASE}/api/objectives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, sprintId: selectedSprint.id, date: currentDate, objective, isDone }),
    });
    fetchDailyData();
  };

  const changeDay = (days: number) => {
    if (!selectedSprint) return;
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(formatDate(d));
  };

  const isFirstDay = selectedSprint && currentDate <= formatDate(selectedSprint.start_date);
  const isLastDay = selectedSprint && currentDate >= formatDate(selectedSprint.end_date);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">SPRINT</h1>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>DASHBOARD</button>
            <button onClick={() => setCurrentView('libraries')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === 'libraries' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>LIBRARIES</button>
          </div>
        </div>
        <div className="flex gap-3">
          {currentView === 'dashboard' ? (
             <button onClick={() => setShowSprintModal(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> NEW SPRINT</button>
          ) : (
            <>
              <button onClick={() => setShowStudentModal(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> STUDENT</button>
              <button onClick={() => setShowProjectModal(true)} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold text-xs"><Plus size={16} className="inline mr-1"/> PROJECT</button>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {currentView === 'dashboard' ? (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-2">
                  {sprints.map(sprint => (
                    <button key={sprint.id} onClick={() => setSelectedSprint(sprint)} className={`w-full text-left p-4 rounded-xl border transition-all group relative ${selectedSprint?.id === sprint.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      <div className="font-bold truncate pr-6">{sprint.name || `Sprint #${sprint.id}`}</div>
                      <div className="text-[10px] opacity-60 mt-1">{formatDate(sprint.start_date)} / {formatDate(sprint.end_date)}</div>
                      <button onClick={(e) => handleDeleteSprint(e, sprint.id)} className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-3 space-y-6">
                  {selectedSprint ? (
                    <>
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
                        <button onClick={() => setShowEnrollModal(true)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"><UserPlus size={14}/> ENROLL</button>
                      </div>

                      <div className="space-y-4">
                        {dailyData.length === 0 ? (
                          <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-500 italic">No sprinters enrolled.</div>
                        ) : (
                          dailyData.map(student => (
                            <div key={student.student_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-lg group hover:border-slate-700 transition-colors relative">
                              <div className="flex items-center gap-4 min-w-[220px]">
                                <img src={student.image_url} alt={student.name} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                                <div>
                                  <h4 className="font-bold text-sm truncate max-w-[140px]">{student.name}</h4>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 font-mono">{student.login}</span>
                                    <select
                                      className="text-[10px] text-purple-400 font-bold uppercase bg-transparent border-none outline-none cursor-pointer mt-0.5 max-w-[150px] truncate"
                                      value={student.project_id || 0}
                                      onChange={(e) => enrollOrUpdateStudent(student.student_id, parseInt(e.target.value), false)}
                                    >
                                      <option value="0" className="bg-slate-900">Select Project</option>
                                      {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name}</option>)}
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 w-full">
                                <input
                                  type="text"
                                  placeholder="Set objective..."
                                  maxLength={20}
                                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all ${student.is_done ? 'line-through text-slate-500 italic' : ''}`}
                                  value={student.objective || ''}
                                  onChange={(e) => setDailyData(dailyData.map(d => d.student_id === student.student_id ? {...d, objective: e.target.value} : d))}
                                  onBlur={(e) => updateObjective(student.student_id, e.target.value, student.is_done || false)}
                                />
                                <div className="text-[9px] text-slate-600 mt-1 ml-2 uppercase font-bold tracking-tighter">
                                  {student.objective?.length || 0}/20 chars
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => updateObjective(student.student_id, student.objective || '', !student.is_done)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${student.is_done ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>{student.is_done ? <CheckCircle2 size={16}/> : <Circle size={16}/>}{student.is_done ? 'DONE' : 'CHECK'}</button>
                                <button onClick={() => removeFromSprint(student.student_id)} className="p-2.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"><UserMinus size={18}/></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : <div className="h-64 flex flex-col items-center justify-center text-slate-600 italic"><Users className="mb-4 opacity-20" size={64}/><p>Select a sprint.</p></div>}
                </div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <h2 className="text-xl font-bold uppercase tracking-widest text-sm mb-8 text-blue-400">Student Library</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map(student => (
                    <div key={student.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center group hover:border-blue-500 transition-all">
                      <img src={student.image_url} className="w-16 h-16 rounded-2xl object-cover mb-3 border-2 border-slate-800 group-hover:border-blue-500 transition-all" />
                      <p className="text-sm font-bold truncate w-full">{student.name}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{student.login}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <h2 className="text-xl font-bold uppercase tracking-widest text-sm mb-8 text-purple-400">Project Library</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map(project => (
                    <div key={project.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center group hover:border-purple-500 transition-all">
                      <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-3 border-2 border-slate-800 group-hover:border-purple-500 transition-all"><Briefcase size={24} className="text-slate-500"/></div>
                      <p className="text-sm font-bold truncate w-full">{project.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Modals - Simplified */}
      {showSprintModal && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl"><h2 className="text-2xl font-bold mb-6 text-blue-400">New Sprint</h2><form onSubmit={handleCreateSprint} className="space-y-4"><input type="text" placeholder="Name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" onChange={e => setSprintForm({...sprintForm, name: e.target.value})}/><input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" onChange={e => setSprintForm({...sprintForm, startDate: e.target.value})}/><input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" onChange={e => setSprintForm({...sprintForm, endDate: e.target.value})}/><div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowSprintModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button><button type="submit" className="flex-1 py-3 bg-blue-600 rounded-xl font-bold">Create</button></div></form></div></div>}

      {showStudentModal && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl"><h2 className="text-2xl font-bold mb-6 text-emerald-400">Add to Library</h2><form onSubmit={handleAddStudent} className="space-y-4"><input type="text" placeholder="Full Name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})}/><input type="text" placeholder="Login" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" value={studentForm.login} onChange={e => setStudentForm({...studentForm, login: e.target.value})}/><input type="url" placeholder="Image URL" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" value={studentForm.imageUrl} onChange={e => setStudentForm({...studentForm, imageUrl: e.target.value})}/><div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowStudentModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button><button type="submit" className="flex-1 py-3 bg-emerald-600 rounded-xl font-bold">Save</button></div></form></div></div>}

      {showProjectModal && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl"><h2 className="text-2xl font-bold mb-6 text-purple-400">Library Project</h2><form onSubmit={handleCreateProject} className="space-y-4"><input type="text" placeholder="Project Name" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})}/><textarea placeholder="Description (optional)" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 min-h-[100px] outline-none" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})}/><div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowProjectModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button><button type="submit" className="flex-1 py-3 bg-purple-600 rounded-xl font-bold">Save</button></div></form></div></div>}

      {showEnrollModal && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl"><h2 className="text-2xl font-bold mb-6">Enroll in {selectedSprint?.name || 'Sprint'}</h2><form onSubmit={(e) => { e.preventDefault(); enrollOrUpdateStudent(enrollForm.studentId, enrollForm.projectId, true); }} className="space-y-6"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Student</label><select required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 appearance-none focus:border-blue-500 outline-none" value={enrollForm.studentId} onChange={e => setEnrollForm({...enrollForm, studentId: parseInt(e.target.value)})}><option value="0">Choose a student...</option>{students.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.login})</option>))}</select></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assign Project</label><select required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 appearance-none focus:border-blue-500 outline-none" value={enrollForm.projectId} onChange={e => setEnrollForm({...enrollForm, projectId: parseInt(e.target.value)})}><option value="0">Choose a project...</option>{projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div><div className="flex gap-3 mt-8"><button type="button" onClick={() => setShowEnrollModal(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancel</button><button type="submit" disabled={enrollForm.studentId === 0 || enrollForm.projectId === 0} className="flex-1 py-3 bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold transition-all">Enroll</button></div></form></div></div>}
    </div>
  )
}

export default App
