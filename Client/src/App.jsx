import React, { useState, useEffect } from 'react';
import DocumentList from './components/DocumentList';
import DocumentEditor from './components/DocumentEditor';
import Login from './components/Login';
import ToastContainer from './components/ToastNotification';

const App = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('list');
  const [documentId, setDocumentId] = useState(null);

  // Check login state on mount
  useEffect(() => {
    const savedName = sessionStorage.getItem('collab-username');
    const savedEmail = sessionStorage.getItem('collab-user-email');
    if (savedName && savedEmail) {
      setUser({ name: savedName, email: savedEmail });
    }
  }, []);

  const handleLogin = ({ name, email }) => {
    sessionStorage.setItem('collab-username', name);
    sessionStorage.setItem('collab-user-email', email);
    setUser({ name, email });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('collab-username');
    sessionStorage.removeItem('collab-user-email');
    setUser(null);
    setDocumentId(null);
    setCurrentView('list');
  };

  const handleSelectDocument = (id) => {
    // Log the last opened time in local storage
    if (user) {
      const lastOpenedKey = `last_opened_${user.name}`;
      const openedData = JSON.parse(localStorage.getItem(lastOpenedKey) || '{}');
      openedData[id] = new Date().toISOString();
      localStorage.setItem(lastOpenedKey, JSON.stringify(openedData));
    }
    setDocumentId(id);
    setCurrentView('editor');
  };

  const handleBack = () => {
    setDocumentId(null);
    setCurrentView('list');
  };

  if (!user) {
    return (
      <>
        <ToastContainer />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="app-main-layout">
        {currentView === 'list' ? (
          <DocumentList 
            onSelectDocument={handleSelectDocument} 
            onLogout={handleLogout}
            currentUser={user}
          />
        ) : (
          <DocumentEditor
            documentId={documentId}
            onBack={handleBack}
          />
        )}
      </div>
    </>
  );
};

export default App;