import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastHost } from './components/Toast';
import { InvestigationProvider } from './features/investigation';
import { initTheme } from './lib/theme';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <InvestigationProvider>
        <App />
        <ToastHost />
      </InvestigationProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
