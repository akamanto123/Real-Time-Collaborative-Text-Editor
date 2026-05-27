import React, { useState } from 'react';
import DocumentList from './components/DocumentList';
import DocumentEditor from './components/DocumentEditor';
import ToastContainer from './components/ToastNotification';

const App = () => {
  const [currentView, setCurrentView] = useState('list');
  const [documentId, setDocumentId] = useState(null);

  const handleSelectDocument = (id) => {
    setDocumentId(id);
    setCurrentView('editor');
  };

  const handleBack = () => {
    setDocumentId(null);
    setCurrentView('list');
  };


  return (
    <>
      <ToastContainer />
      <div className="container">
        {currentView === 'list' ? (
          <DocumentList onSelectDocument={handleSelectDocument} />
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