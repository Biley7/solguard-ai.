import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

import './styles/main.css';
import './styles/components.css';
import './styles/overview.css';
import './styles/features.css';
import './styles/beta.css';
import './styles/motion.css';
import { mountApp } from './app.js';

mountApp();
