import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastHost } from './components/Toast';
import { InvestigationProvider } from './features/investigation';
import './index.css';

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
