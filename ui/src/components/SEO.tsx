import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    image?: string;
    type?: 'website' | 'article';
    url?: string;
    keywords?: string[];
}

export default function SEO({
    title,
    description,
    image = '/og-image.png',
    type = 'website',
    url,
    keywords = []
}: SEOProps) {
    const siteUrl = url || window.location.href;
    const fullTitle = title.includes('UatuAudit') ? title : `${title} | UatuAudit`;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />
            {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={siteUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={siteUrl} />
            <meta property="twitter:title" content={fullTitle} />
            <meta property="twitter:description" content={description} />
            <meta property="twitter:image" content={image} />

            {/* Canonical URL */}
            <link rel="canonical" href={siteUrl} />
        </Helmet>
    );
}
