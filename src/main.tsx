import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './polyfills.js'

createRoot(document.getElementById("root")!).render(<App />);
