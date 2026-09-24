import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { BrandProvider } from './brand/BrandContext';
import { PermissionProvider } from './permissions/PermissionContext';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <BrandProvider>
          <AuthProvider>
            <PermissionProvider>
              <App />
            </PermissionProvider>
          </AuthProvider>
        </BrandProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
