import type { FC } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Features from './pages/Features';
import About from './pages/About';
import DocsQuickstart from './pages/DocsQuickstart';
import DocsIndex from './pages/DocsIndex';
import DocsConfig from './pages/DocsConfig';
import DocsSecurity from './pages/DocsSecurity';
import DocsAPI from './pages/DocsAPI';
import DocsTroubleshooting from './pages/DocsTroubleshooting';
import UseCasesIndex from './pages/UseCasesIndex';
import UseCaseEnterprise from './pages/UseCaseEnterprise';
import UseCaseMultiCloud from './pages/UseCaseMultiCloud';
import UseCaseStartups from './pages/UseCaseStartups';
import UseCaseSaaS from './pages/UseCaseSaaS';
import UseCaseDevelopment from './pages/UseCaseDevelopment';
import UseCaseCompliance from './pages/UseCaseCompliance';
import { Routes, Route } from 'react-router-dom';

const App: FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text font-sans">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/docs" element={<DocsIndex />} />
          <Route path="/docs/quickstart" element={<DocsQuickstart />} />
          <Route path="/docs/config" element={<DocsConfig />} />
          <Route path="/docs/api" element={<DocsAPI />} />
          <Route path="/docs/security" element={<DocsSecurity />} />
          <Route path="/docs/troubleshooting" element={<DocsTroubleshooting />} />
          <Route path="/use-cases" element={<UseCasesIndex />} />
          <Route path="/use-cases/enterprise-governance" element={<UseCaseEnterprise />} />
          <Route path="/use-cases/multi-cloud-llm" element={<UseCaseMultiCloud />} />
          <Route path="/use-cases/cost-control-startups" element={<UseCaseStartups />} />
          <Route path="/use-cases/saas-integration" element={<UseCaseSaaS />} />
          <Route path="/use-cases/development-testing" element={<UseCaseDevelopment />} />
          <Route path="/use-cases/data-privacy-compliance" element={<UseCaseCompliance />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;


