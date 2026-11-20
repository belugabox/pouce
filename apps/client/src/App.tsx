import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { PageLoader } from './components/PageLoader';
import { SearchPage } from './pages/SearchPage';

// L'éditeur (et OpenSheetMusicDisplay, lourd) se charge à la demande.
const EditorPage = lazy(() => import('./pages/EditorPage'));

export const App = () => (
    <Suspense fallback={<PageLoader />}>
        <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/partition/:source/:id" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </Suspense>
);
