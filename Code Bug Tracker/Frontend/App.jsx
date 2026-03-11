
import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = "http://localhost:8000/api";

function App() {
  const [bugs, setBugs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('detail');
  const [selectedBugId, setSelectedBugId] = useState(null);
  const [notification, setNotification] = useState({ show: false, msg: '', type: 'success' });
  
  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '', priority: 'medium', lang: '', desc: '', code: '', assignee: '', status: 'open'
  });

  // Fetch Bugs
  const fetchBugs = async () => {
    try {
      const res = await fetch(`${API_URL}/bugs`);
      const data = await res.json();
      setBugs(data);
    } catch (err) {
      showNotify('Failed to connect to server', 'warn');
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const showNotify = (msg, type = 'success') => {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => showNotify('Code copied to clipboard!'));
  };

  const statusLabel = (s) => {
    return { 'open': '● Open', 'in-progress': '◐ In Progress', 'review': '◑ In Review', 'closed': '✓ Closed' }[s] || s;
  };

  // ========================
  // AI-POWERED AUTO-DETECT
  // ========================
  const handleCodePaste = async (e) => {
    // Grab the code straight from the user's clipboard
    const pastedCode = e.clipboardData.getData('Text');
    const currentDesc = formData.desc;
    
    if (!pastedCode) return;

    // Show a quick visual cue so the user knows the AI is thinking
    showNotify('🤖 AI is detecting language and priority...', 'success');

    try {
      const res = await fetch(`${API_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pastedCode, desc: currentDesc })
      });
      
      const data = await res.json();
      
      if (data.lang && data.priority) {
        // Automatically update the form dropdowns with the AI's findings
        setFormData(prev => ({
          ...prev,
          code: pastedCode,
          lang: data.lang,
          priority: data.priority
        }));
        showNotify(`🤖 Detected: ${data.lang} | ${data.priority.toUpperCase()} Priority`);
      }
    } catch (err) {
      console.error('AI Detection failed silently', err);
    }
  };

  // Actions
  const handleSelectBug = (id) => {
    setSelectedBugId(id);
    setActiveTab('detail');
    setAnalysisResult(null); // Reset AI view when switching bugs
  };

  const handleCloseBug = async (id) => {
    await fetch(`${API_URL}/bugs/${id}/close`, { method: 'PUT' });
    fetchBugs();
    showNotify('Bug marked as closed ✓');
  };

  const handleDeleteBug = async (id) => {
    await fetch(`${API_URL}/bugs/${id}`, { method: 'DELETE' });
    setSelectedBugId(null);
    fetchBugs();
    showNotify('Bug deleted');
  };

  const handleAddBug = async () => {
    if (!formData.title) return showNotify('⚠️ Bug title is required', 'warn');
    if (!formData.code) return showNotify('⚠️ Please paste the buggy code', 'warn');

    try {
      const res = await fetch(`${API_URL}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      setFormData({ title: '', priority: 'medium', lang: '', desc: '', code: '', assignee: '', status: 'open' });
      await fetchBugs();
      showNotify(`✓ ${data.id} created successfully!`);
      handleSelectBug(data.id);
    } catch (err) {
      showNotify('Error creating bug', 'warn');
    }
  };

  const handleAnalyze = async (id) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bug_id: id })
      });
      
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      setAnalysisResult({ error: true, msg: "⚠️ Analysis failed. Check server/API key." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Derived State
  const filteredBugs = filter === 'all' ? bugs : bugs.filter(b => b.status === filter);
  const selectedBug = bugs.find(b => b.id === selectedBugId);

  const stats = {
    open: bugs.filter(b => b.status === 'open').length,
    progress: bugs.filter(b => b.status === 'in-progress').length,
    closed: bugs.filter(b => b.status === 'closed').length,
  };

  const priorityColors = { critical: 'var(--red)', high: 'var(--warn)', medium: 'var(--accent2)', low: 'var(--green)' };

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🐛</div>
          Bug<span>Lab</span>
        </div>
        <div className="header-stats">
          <div className="stat-pill"><div className="stat-dot" style={{background: 'var(--red)'}}></div><span>{stats.open}</span> Open</div>
          <div className="stat-pill"><div className="stat-dot" style={{background: 'var(--warn)'}}></div><span>{stats.progress}</span> In Progress</div>
          <div className="stat-pill"><div className="stat-dot" style={{background: 'var(--green)'}}></div><span>{stats.closed}</span> Closed</div>
        </div>
      </header>

      {/* MAIN */}
      <div className="main">
        {/* LEFT PANEL */}
        <div className="panel-left">
          <div className="panel-header">
            <span className="panel-title">Bug Reports</span>
            <button className="btn-new" onClick={() => setActiveTab('add')}>+ New Bug</button>
          </div>
          <div className="filter-bar">
            {['all', 'open', 'in-progress', 'closed'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
          <div className="bug-list">
            {filteredBugs.length === 0 ? (
              <div style={{textAlign: 'center', color: 'var(--dim)', fontSize: '0.8rem', padding: '2rem'}}>No bugs found</div>
            ) : (
              filteredBugs.map(bug => (
                <div key={bug.id} className={`bug-card ${bug.priority} ${selectedBugId === bug.id ? 'active' : ''}`} onClick={() => handleSelectBug(bug.id)}>
                  <div className="bug-card-top">
                    <span className="bug-title-card">{bug.title}</span>
                    <span className={`priority-badge ${bug.priority}`}>{bug.priority}</span>
                  </div>
                  <div className="bug-meta">
                    <span className="bug-id">{bug.id}</span>
                    <span className="tag">{bug.lang}</span>
                    <span className={`tag status-${bug.status}`}>{statusLabel(bug.status)}</span>
                    <span className="tag">{bug.created}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="panel-right">
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'detail' ? 'active' : ''}`} onClick={() => setActiveTab('detail')}>Bug Detail</button>
            <button className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>+ Report Bug</button>
          </div>

          {/* DETAIL TAB */}
          <div className={`tab-content ${activeTab === 'detail' ? 'active' : ''}`}>
            {!selectedBug ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div>Select a bug to inspect</div>
                <div style={{fontSize: '0.75rem', color: 'var(--dim)'}}>or report a new one</div>
              </div>
            ) : (
              <div className="detail-pane">
                <div className="detail-header">
                  <div>
                    <div className="detail-id">{selectedBug.id}</div>
                    <div className="detail-title">{selectedBug.title}</div>
                  </div>
                  <div className="detail-actions">
                    <button className="btn-icon" title="Mark as closed" onClick={() => handleCloseBug(selectedBug.id)}>✓</button>
                    <button className="btn-icon" title="Delete bug" onClick={() => handleDeleteBug(selectedBug.id)}>🗑</button>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-cell"><div className="info-label">Priority</div><div className="info-value" style={{color: priorityColors[selectedBug.priority]}}>{selectedBug.priority}</div></div>
                  <div className="info-cell"><div className="info-label">Status</div><div className={`info-value status-${selectedBug.status}`}>{statusLabel(selectedBug.status)}</div></div>
                  <div className="info-cell"><div className="info-label">Language</div><div className="info-value">{selectedBug.lang}</div></div>
                  <div className="info-cell"><div className="info-label">Assigned To</div><div className="info-value">{selectedBug.assignee || '—'}</div></div>
                  <div className="info-cell"><div className="info-label">Created</div><div className="info-value">{selectedBug.created}</div></div>
                </div>

                <div className="section-label">Description</div>
                <div className="desc-block">{selectedBug.desc}</div>

                <div className="section-label">Buggy Code</div>
                <div className="code-block">
                  <div className="code-block-header">
                    <span className="code-lang">{selectedBug.lang}</span>
                    <button className="btn-copy" onClick={() => copyCode(selectedBug.code)}>Copy</button>
                  </div>
                  <pre>{selectedBug.code}</pre>
                </div>

                {/* AI SECTION */}
                <div className="ai-section">
                  <div className="ai-header">
                    <div className="ai-label"><div className="ai-dot"></div>AI Code Analyzer</div>
                    <button className="btn-analyze" disabled={isAnalyzing} onClick={() => handleAnalyze(selectedBug.id)}>
                      {isAnalyzing ? '⏳ Analyzing...' : '⚡ Analyze & Fix'}
                    </button>
                  </div>
                  
                  {isAnalyzing && <div className="loading-bar" style={{display: 'block'}}><div className="loading-fill"></div></div>}
                  
                  {analysisResult && !analysisResult.error && (
                    <div>
                      <div className="section-label" style={{marginTop: '0.5rem'}}>❌ What's Wrong</div>
                      <div className="explanation">{analysisResult.whatIsWrong}</div>
                      
                      <div className="section-label">🔧 How to Fix It</div>
                      <div className="explanation">{analysisResult.howToFix}</div>
                      
                      <div className="fix-label">✅ Corrected Code</div>
                      <div className="code-block">
                        <div className="code-block-header">
                          <span className="code-lang" style={{color: 'var(--green)'}}>FIXED — {selectedBug.lang}</span>
                          <button className="btn-copy" onClick={() => copyCode(analysisResult.fixedCode)}>Copy Fixed Code</button>
                        </div>
                        <pre>{analysisResult.fixedCode}</pre>
                      </div>
                      
                      <div className="section-label">💡 Improvements & Best Practices</div>
                      <div className="explanation">{analysisResult.improvements}</div>
                    </div>
                  )}

                  {analysisResult?.error && (
                    <div className="explanation" style={{borderColor: 'var(--red)'}}>{analysisResult.msg}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ADD TAB */}
          <div className={`tab-content ${activeTab === 'add' ? 'active' : ''}`}>
            <div className="form-pane">
              <div className="form-section-title">🐛 Report a Bug</div>
              
              <div className="form-row">
                <label className="form-label">Bug Title *</label>
                <input type="text" className="form-input" placeholder="e.g., Login button not responding on mobile" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div className="form-row-2">
                <div className="form-row">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟣 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Language / Framework</label>
                  <input type="text" className="form-input" placeholder="e.g., JavaScript, Python" value={formData.lang} onChange={e => setFormData({...formData, lang: e.target.value})} />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Describe the bug..." value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})}></textarea>
              </div>

              <div className="form-row">
                <label className="form-label">⚠️ Paste Your Buggy Code Here</label>
                <textarea 
                  className="form-code" 
                  id="f-code"
                  placeholder="// Paste code here..." 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  onPaste={handleCodePaste}  /* Added the onPaste trigger here! */
                ></textarea>
              </div>

              <div className="form-row-2">
                <div className="form-row">
                  <label className="form-label">Assigned To</label>
                  <input type="text" className="form-input" placeholder="e.g., @dev-team" value={formData.assignee} onChange={e => setFormData({...formData, assignee: e.target.value})} />
                </div>
                <div className="form-row">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">In Review</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <button className="btn-submit" onClick={handleAddBug}>Submit Bug Report</button>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICATION */}
      <div className={`notify ${notification.show ? 'show' : ''}`} style={{ borderLeftColor: notification.type === 'warn' ? 'var(--warn)' : 'var(--green)' }}>
        {notification.msg}
      </div>
    </>
  );
}

export default App;
