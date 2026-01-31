import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useParams, useNavigate, Navigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8084';

// API functions
const api = {
  getCourses: () => axios.get(`${API_URL}/api/courses`),
  getCourse: (id) => axios.get(`${API_URL}/api/courses/${id}`),
  getCourseLessons: (courseId) => axios.get(`${API_URL}/api/courses/${courseId}/lessons`),
  getCourseLesson: (courseId, lessonId) => axios.get(`${API_URL}/api/courses/${courseId}/lessons/${lessonId}`),
  getChallenges: () => axios.get(`${API_URL}/api/challenges`),
  getChallenge: (id) => axios.get(`${API_URL}/api/challenges/${id}`),
  executeCode: (code) => axios.post(`${API_URL}/api/execute`, { code }),
  submitChallenge: (id, code) => axios.post(`${API_URL}/api/challenges/${id}/submit`, { code, challenge_id: id }),
};

// Require Auth Component
function RequireAuth({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Progress Context
const ProgressContext = React.createContext();

function useProgress() {
  return React.useContext(ProgressContext);
}

function ProgressProvider({ children }) {
  const { currentUser } = useAuth();
  const [completedLessons, setCompletedLessons] = useState([]);
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      if (currentUser) {
        setProgressLoading(true);
        console.log("Fetching progress for:", currentUser.uid);
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Loaded data:", data);
            setCompletedLessons(data.completedLessons || []);
            setCompletedChallenges(data.completedChallenges || []);
          } else {
            console.log("No data found, creating profile...");
            await setDoc(docRef, { completedLessons: [], completedChallenges: [] });
            setCompletedLessons([]);
            setCompletedChallenges([]);
          }
        } catch (e) {
          console.error("Error loading progress:", e);
          alert(`Error loading progress: ${e.message}\n\nCheck if your Firestore Database is created in Firebase Console.`);
        } finally {
          setProgressLoading(false);
        }
      } else {
        setCompletedLessons([]);
        setCompletedChallenges([]);
        setProgressLoading(false);
      }
    }
    loadProgress();
  }, [currentUser?.uid]);

  const markLessonComplete = async (lessonId) => {
    if (!currentUser) return;
    if (!completedLessons.includes(lessonId)) {
      // Optimistic update
      const newCompleted = [...completedLessons, lessonId];
      setCompletedLessons(newCompleted);
      
      try {
        const docRef = doc(db, "users", currentUser.uid);
        await setDoc(docRef, { completedLessons: arrayUnion(lessonId) }, { merge: true });
        console.log("Saved lesson:", lessonId);
      } catch (e) {
        console.error("Save failed:", e);
        alert("Failed to save progress! " + e.message);
        // Revert on failure
        setCompletedLessons(prev => prev.filter(id => id !== lessonId));
      }
    }
  };

  const markChallengeComplete = async (challengeId) => {
    if (!currentUser) return;
    if (!completedChallenges.includes(challengeId)) {
      // Optimistic update
      const newCompleted = [...completedChallenges, challengeId];
      setCompletedChallenges(newCompleted);
      
      try {
        const docRef = doc(db, "users", currentUser.uid);
        await setDoc(docRef, { completedChallenges: arrayUnion(challengeId) }, { merge: true });
        console.log("Saved challenge:", challengeId);
      } catch (e) {
        console.error("Save failed:", e);
        alert("Failed to save progress! " + e.message);
        // Revert on failure
        setCompletedChallenges(prev => prev.filter(id => id !== challengeId));
      }
    }
  };

  const value = {
    completedLessons,
    completedChallenges,
    markLessonComplete,
    markChallengeComplete,
    progressLoading
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}


// Header Component
function Header() {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch {
      console.error('Failed to log out');
    }
  }

  return (
    <header className="header">
      <Link to="/" className="logo">
        <span className="logo-icon">🐍</span>
        <span>PySnakeByte</span>
      </Link>
      <nav className="nav">
        {currentUser ? (
          <>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            <Link to="/courses" className={location.pathname.startsWith('/courses') ? 'active' : ''}>Courses</Link>
            <Link to="/challenges" className={location.pathname.startsWith('/challenges') ? 'active' : ''}>Challenges</Link>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem' }}>
              Log Out ({currentUser.email.split('@')[0]})
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}>Log In</Link>
        )}
      </nav>
    </header>
  );
}

// Code Editor Component
function CodeEditor({ initialCode = '', onSubmit, showSubmit = false, readOnly = false }) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => { setCode(initialCode); }, [initialCode]);

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...');
    try {
      const response = await api.executeCode(code);
      const result = response.data;
      if (result.success) { setOutput(result.output || 'Code executed successfully (no output)'); setIsError(false); }
      else { setOutput(result.error || 'An error occurred'); setIsError(true); }
    } catch (error) { setOutput(error.response?.data?.detail || 'Failed to execute code'); setIsError(true); }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    if (onSubmit) { setIsSubmitting(true); await onSubmit(code); setIsSubmitting(false); }
  };

  return (
    <div className="code-editor-container">
      <div className="editor-header">
        <span className="editor-title">Python Editor</span>
        <div className="editor-actions">
          <button className="btn btn-secondary" onClick={() => setCode(initialCode)}>Reset</button>
          <button className="btn btn-primary" onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running...' : '▶ Run'}
          </button>
          {showSubmit && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting} style={{background: '#3fb950'}}>
              {isSubmitting ? 'Submitting...' : '✓ Submit'}
            </button>
          )}
        </div>
      </div>
      <div className="editor-wrapper">
        <Editor height="100%" language="python" theme="vs-dark" value={code} onChange={setCode}
          options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, readOnly }} />
      </div>
      <div className={`output-panel ${isError ? 'error' : 'success'}`}>
        <pre>{output || 'Output will appear here...'}</pre>
      </div>
    </div>
  );
}

// Home Page
function HomePage() {
  const [courses, setCourses] = useState([]);
  const { currentUser } = useAuth();
  
  useEffect(() => {
    api.getCourses().then(res => setCourses(res.data.courses || [])).catch(console.error);
  }, []);

  return (
    <div className="main-content" style={{ flexDirection: 'column' }}>
      <section className="hero">
        <h1>Master Python Programming</h1>
        <p>Learn Python from scratch with interactive lessons and hands-on coding challenges. Choose a course to get started.</p>
        <div className="stats">
          <div className="stat"><div className="stat-value">300+</div><div className="stat-label">Lessons</div></div>
          <div className="stat"><div className="stat-value">25</div><div className="stat-label">Challenges</div></div>
          <div className="stat"><div className="stat-value">3</div><div className="stat-label">Courses</div></div>
        </div>
        <div className="hero-actions">
          {currentUser ? (
            <>
              <Link to="/courses" className="btn btn-primary btn-large">Browse Courses</Link>
              <Link to="/challenges" className="btn btn-secondary btn-large">Try Challenges</Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-large">Start Learning Now</Link>
          )}
        </div>
      </section>
      <section className="categories">
        {courses.map(course => (
          <Link to={`/courses/${course.id}`} key={course.id} className="category-card" style={{ textDecoration: 'none' }}>
            <div className="category-icon" style={{ fontSize: '3rem' }}>{course.icon}</div>
            <div className="category-name">{course.title}</div>
            <div className="category-count">{course.lessonCount} lessons • {course.duration}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{course.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

// Courses List Page
function CoursesPage() {
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api.getCourses().then(res => setCourses(res.data.courses || [])).catch(console.error);
  }, []);

  return (
    <div className="main-content" style={{ flexDirection: 'column', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <h1 className="lesson-title">Available Courses</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Choose a course to start learning Python
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          {courses.map(course => (
            <Link to={`/courses/${course.id}`} key={course.id} className="category-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '3rem' }}>{course.icon}</span>
                <div>
                  <div className="category-name">{course.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{course.difficulty}</div>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>{course.description}</p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--accent)' }}>
                <span>{course.lessonCount} lessons</span>
                <span>{course.duration}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lessons Sidebar
function LessonsSidebar({ lessons, currentLesson, completedLessons, courseId }) {
  const isCompleted = (id) => completedLessons.includes(`${courseId}:${id}`);
  return (
    <aside className="sidebar">
      {lessons.categories?.map((category, catIdx) => (
        <div key={catIdx} className="sidebar-section">
          <div className="sidebar-title">{category.name}</div>
          <ul className="lesson-list">
            {category.lessons?.map((lesson, idx) => (
              <li key={lesson.id} className="lesson-item">
                <Link to={`/courses/${courseId}/lessons/${lesson.id}`} 
                  className={`lesson-link ${currentLesson === lesson.id ? 'active' : ''}`}>
                  {isCompleted(lesson.id) ? (
                    <span className="lesson-number" style={{ color: '#3fb950' }}>✓</span>
                  ) : (
                    <span className="lesson-number">{idx + 1}</span>
                  )}
                  <span>{lesson.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

// Course Detail / Lesson Page
function CourseDetailPage() {
  const { courseId, lessonId } = useParams();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState({ categories: [] });
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const { completedLessons, markLessonComplete } = useProgress();

  useEffect(() => {
    api.getCourse(courseId).then(res => setCourse(res.data)).catch(console.error);
    api.getCourseLessons(courseId).then(res => setLessons(res.data)).catch(console.error);
  }, [courseId]);

  useEffect(() => {
    if (lessonId) {
      setLoading(true);
      api.getCourseLesson(courseId, lessonId)
        .then(res => { setLesson(res.data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  const handleMarkComplete = () => {
    if (lessonId) {
      const key = `${courseId}:${lessonId}`;
      markLessonComplete(key);
    }
  };

  const allLessons = lessons.categories?.flatMap(c => c.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l?.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = completedLessons.includes(`${courseId}:${lessonId}`);
  const completedCount = allLessons.filter(l => completedLessons.includes(`${courseId}:${l.id}`)).length;

  if (!lessonId) {
    return (
      <div className="main-content">
        <LessonsSidebar lessons={lessons} currentLesson={null} completedLessons={completedLessons} courseId={courseId} />
        <div className="content">
          <Link to="/courses" className="btn btn-secondary" style={{ marginBottom: '1rem' }}>← All Courses</Link>
          <h1 className="lesson-title">{course?.icon} {course?.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {course?.description}
            <span style={{ marginLeft: '1rem', color: '#3fb950' }}>{completedCount} / {allLessons.length} completed</span>
          </p>
          <div style={{ marginTop: '2rem' }}>
            {lessons.categories?.map(cat => {
              const catCompleted = cat.lessons?.filter(l => completedLessons.includes(`${courseId}:${l.id}`)).length || 0;
              return (
                <div key={cat.name} style={{ marginBottom: '2rem' }}>
                  <h2>{cat.name}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {cat.lessons?.length} lessons <span style={{ color: '#3fb950' }}>({catCompleted} completed)</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading"><div className="spinner"></div>Loading lesson...</div>;
  if (!lesson) return <div className="content"><h1>Lesson not found</h1></div>;

  return (
    <div className="main-content">
      <LessonsSidebar lessons={lessons} currentLesson={lessonId} completedLessons={completedLessons} courseId={courseId} />
      <div className="content">
        <header className="lesson-header">
          <div className="lesson-category">{lesson.category}</div>
          <h1 className="lesson-title">
            {isCompleted && <span style={{ color: '#3fb950', marginRight: '0.5rem' }}>✓</span>}
            {lesson.title}
          </h1>
          <div className="lesson-meta">Lesson {lesson.number} • {lesson.duration}</div>
        </header>
        <div className="lesson-content"><ReactMarkdown>{lesson.content}</ReactMarkdown></div>
        {lesson.code && (<><h2>Try It Yourself</h2><CodeEditor initialCode={lesson.code} /></>)}
        <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          {!isCompleted ? (
            <button className="btn btn-primary" onClick={handleMarkComplete} style={{ background: '#3fb950' }}>✓ Mark as Complete</button>
          ) : (
            <span style={{ color: '#3fb950', fontWeight: '500' }}>✓ Lesson completed</span>
          )}
        </div>
        <nav className="lesson-nav">
          {prevLesson ? <Link to={`/courses/${courseId}/lessons/${prevLesson.id}`} className="nav-btn">← {prevLesson.title}</Link> : <div />}
          {nextLesson && <Link to={`/courses/${courseId}/lessons/${nextLesson.id}`} className="nav-btn">{nextLesson.title} →</Link>}
        </nav>
      </div>
    </div>
  );
}

// Challenges Page
function ChallengesPage() {
  const { challengeId } = useParams();
  const [challenges, setChallenges] = useState({ challenges: [] });
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [result, setResult] = useState(null);
  const { completedChallenges, markChallengeComplete } = useProgress();

  useEffect(() => {
    api.getChallenges().then(res => setChallenges(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (challengeId) {
      api.getChallenge(challengeId).then(res => setSelectedChallenge(res.data)).catch(console.error);
      setResult(null);
    }
  }, [challengeId]);

  const handleSubmit = async (code) => {
    try {
      const response = await api.submitChallenge(challengeId, code);
      setResult(response.data);
      if (response.data.passed) { markChallengeComplete(challengeId); }
    } catch (error) { setResult({ passed: false, error: error.message }); }
  };

  const isCompleted = (id) => completedChallenges.includes(id);

  if (challengeId && selectedChallenge) {
    return (
      <div className="main-content" style={{ flexDirection: 'column', padding: '2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <Link to="/challenges" className="btn btn-secondary" style={{ marginBottom: '1rem' }}>← Back to Challenges</Link>
          <div className="challenge-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 className="lesson-title" style={{ margin: 0 }}>
              {isCompleted(challengeId) && <span style={{ color: '#3fb950', marginRight: '0.5rem' }}>✓</span>}
              {selectedChallenge.title}
            </h1>
            <span className={`difficulty-badge difficulty-${selectedChallenge.difficulty}`}>{selectedChallenge.difficulty}</span>
          </div>
          <div className="lesson-content"><ReactMarkdown>{selectedChallenge.description}</ReactMarkdown></div>
          <h3>Your Solution</h3>
          <CodeEditor initialCode={selectedChallenge.starter_code || '# Write your solution here\n'} showSubmit={true} onSubmit={handleSubmit} />
          {result && (
            <div style={{ padding: '1rem', borderRadius: '8px', background: result.passed ? 'rgba(63, 185, 80, 0.2)' : 'rgba(248, 81, 73, 0.2)', marginTop: '1rem' }}>
              {result.passed ? '✅ All tests passed!' : `❌ Tests failed: ${result.error || result.output}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ flexDirection: 'column', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <h1 className="lesson-title">Code Challenges</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Test your Python skills with coding challenges.
          <span style={{ marginLeft: '1rem', color: '#3fb950' }}>{completedChallenges.length} / {challenges.challenges?.length || 0} completed</span>
        </p>
        {['easy', 'medium', 'hard'].map(difficulty => {
          const filtered = challenges.challenges?.filter(c => c.difficulty === difficulty) || [];
          if (filtered.length === 0) return null;
          return (
            <div key={difficulty} style={{ marginBottom: '2rem' }}>
              <h2 style={{ textTransform: 'capitalize', marginBottom: '1rem' }}>{difficulty} Challenges</h2>
              {filtered.map(challenge => (
                <Link to={`/challenges/${challenge.id}`} key={challenge.id} className="challenge-card" style={{ display: 'block', textDecoration: 'none' }}>
                  <div className="challenge-header">
                    <span className="challenge-title">
                      {isCompleted(challenge.id) && <span style={{ color: '#3fb950', marginRight: '0.5rem', fontWeight: 'bold' }}>✓</span>}
                      {challenge.title}
                    </span>
                    <span className={`difficulty-badge difficulty-${challenge.difficulty}`}>{challenge.difficulty}</span>
                  </div>
                  <p className="challenge-description">{challenge.short_description}</p>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main App
function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <div className="app">
          <Header />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={
              <RequireAuth>
                <CoursesPage />
              </RequireAuth>
            } />
            <Route path="/courses/:courseId" element={
              <RequireAuth>
                <CourseDetailPage />
              </RequireAuth>
            } />
            <Route path="/courses/:courseId/lessons/:lessonId" element={
              <RequireAuth>
                <CourseDetailPage />
              </RequireAuth>
            } />
            <Route path="/challenges" element={
              <RequireAuth>
                <ChallengesPage />
              </RequireAuth>
            } />
            <Route path="/challenges/:challengeId" element={
              <RequireAuth>
                <ChallengesPage />
              </RequireAuth>
            } />
          </Routes>
        </div>
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
