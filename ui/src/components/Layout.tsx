import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';

interface LayoutProps {
    isAuthed: boolean;
    onLogin: () => void;
}

export default function Layout({ isAuthed, onLogin }: LayoutProps) {
    return (
        <div className="min-h-screen flex flex-col">
            <Header isAuthed={isAuthed} onLogin={onLogin} />
            <Breadcrumbs />
            <main className="flex-grow">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
