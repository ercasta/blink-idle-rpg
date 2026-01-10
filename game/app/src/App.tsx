/**
 * Blink IDE Application
 * 
 * An integrated development environment for BRL/BCL/BDL game development.
 * Runs entirely in the browser with no backend server required.
 */

import { useState } from 'react';
import { IDE } from './components/ide';
import { GameUI } from './components/GameUI';

function App() {
  const [showIDE, setShowIDE] = useState(true);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <GameUI />
      </div>
      {showIDE && (
        <div style={{ width: '50%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <IDE />
        </div>
      )}
      <button
        onClick={() => setShowIDE(!showIDE)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1001,
          padding: '8px 12px',
          backgroundColor: '#333',
          color: 'white',
          border: '1px solid #555',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {showIDE ? 'Hide IDE' : 'Show IDE'}
      </button>
    </div>
  );
}

export default App;
