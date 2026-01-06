import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    path: string;
}

export default function Breadcrumbs() {
    const location = useLocation();

    // Generate breadcrumb items from current path
    const generateBreadcrumbs = (): BreadcrumbItem[] => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', path: '/' }];

        let currentPath = '';
        paths.forEach((path) => {
            currentPath += `/${path}`;
            const label = path
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            breadcrumbs.push({ label, path: currentPath });
        });

        return breadcrumbs;
    };

    const breadcrumbs = generateBreadcrumbs();

    // Don't show breadcrumbs on homepage
    if (location.pathname === '/') {
        return null;
    }

    return (
        <nav className="py-6 border-b border-black/[0.04] bg-white/60 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-10">
                <ol className="flex items-center gap-3 text-sm">
                    {breadcrumbs.map((crumb, index) => {
                        const isLast = index === breadcrumbs.length - 1;
                        const isHome = index === 0;

                        return (
                            <li key={crumb.path} className="flex items-center gap-3">
                                {index > 0 && (
                                    <ChevronRight size={14} className="text-slate-300" strokeWidth={2} />
                                )}
                                {isLast ? (
                                    <span className="font-bold text-slate-900 flex items-center gap-2">
                                        {isHome && <Home size={14} strokeWidth={2} />}
                                        {crumb.label}
                                    </span>
                                ) : (
                                    <Link
                                        to={crumb.path}
                                        className="font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                    >
                                        {isHome && <Home size={14} strokeWidth={2} />}
                                        {crumb.label}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </nav>
    );
}
