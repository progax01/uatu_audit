import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
    isAuthed: boolean;
    onLogin: () => void;
}

export default function Layout({ isAuthed, onLogin }: LayoutProps) {
    return (
        <div className="min-h-screen flex flex-col bg-white">
            <Header isAuthed={isAuthed} onLogin={onLogin} />
            <main className="flex-grow pt-20">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
