/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 */

import './index.css';
import './renderer/types/ipc';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';

const root = createRoot(document.getElementById('root')!);
root.render(
  React.createElement(React.StrictMode, null, React.createElement(App))
);
