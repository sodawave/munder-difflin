import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StaplerApp } from './StaplerApp';
import '../design/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('No root element');

createRoot(root).render(
  <StrictMode>
    <StaplerApp />
  </StrictMode>
);
