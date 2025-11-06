import type { FC } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Features from './pages/Features';
import DocsQuickstart from './pages/DocsQuickstart';
import DocsIndex from './pages/DocsIndex';
import DocsConfig from './pages/DocsConfig';
import { Routes, Route } from 'react-router-dom';

const App: FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text font-sans">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/docs" element={<DocsIndex />} />
          <Route path="/docs/quickstart" element={<DocsQuickstart />} />
          <Route path="/docs/config" element={<DocsConfig />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;


