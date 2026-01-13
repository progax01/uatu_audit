import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    type?: 'website' | 'article' | 'product';
    url?: string;
    keywords?: string[];
    noindex?: boolean;
    publishedTime?: string;
    modifiedTime?: string;
}

// Default SEO configuration
const defaults = {
    siteName: 'Uatu',
    title: 'AI-Powered Smart Contract Security Audits',
    description: 'Secure your smart contracts with Uatu\'s AI-powered security audits. Detect vulnerabilities in Solidity, Rust, and Move contracts across Ethereum, Solana, and 9+ chains. Free quick scans available.',
    image: 'https://uatu.xyz/meta.png',
    keywords: [
        'smart contract audit',
        'blockchain security',
        'solidity audit',
        'defi security',
        'web3 security',
        'ethereum audit',
        'solana audit',
        'rust audit',
        'move audit',
        'AI security audit',
        'vulnerability detection',
        'code review',
        'crypto security',
        'smart contract scanner',
        'blockchain audit',
        'uatu'
    ],
    siteUrl: 'https://uatu.xyz',
    twitterHandle: '@Uatuhq'
};

// Page-specific SEO configurations
export const pageSEO = {
    home: {
        title: 'AI-Powered Smart Contract Security Audits | Web3 Security Platform',
        description: 'Secure your smart contracts with Uatu\'s AI-powered security audits. Detect vulnerabilities in Solidity, Rust, and Move contracts across Ethereum, Solana, and 9+ chains. Free quick scans available.',
        keywords: ['web3 security platform', 'smart contract security', 'blockchain security audit']
    },
    features: {
        title: 'Features - Advanced AI Security Analysis Tools',
        description: 'Discover Uatu\'s cutting-edge security features: AI-powered vulnerability detection, multi-chain support, real-time monitoring, automated code review, and comprehensive audit reports.',
        keywords: ['security features', 'vulnerability scanner', 'automated audit', 'code analysis', 'AI security']
    },
    pricing: {
        title: 'Pricing - Flexible Security Audit Plans',
        description: 'Transparent pricing for smart contract audits. Free quick scans, professional audits for startups to enterprises. No hidden fees.',
        keywords: ['audit pricing', 'security audit cost', 'smart contract audit price', 'free security scan']
    },
    howItWorks: {
        title: 'How It Works - Simple 3-Step Security Audit Process',
        description: 'Get your smart contracts audited in minutes. Connect your contract or repo, run AI-powered analysis, and receive comprehensive security reports with actionable fixes.',
        keywords: ['how to audit smart contract', 'security audit process', 'audit workflow', 'contract verification']
    },
    supportedChains: {
        title: 'Supported Chains - Multi-Chain Security Coverage',
        description: 'Comprehensive security audits for Ethereum, Solana, Polygon, Arbitrum, Base, BSC, Avalanche, Optimism, and more. Full multi-chain security coverage.',
        keywords: ['ethereum audit', 'solana audit', 'polygon security', 'arbitrum audit', 'base chain security', 'multi-chain audit']
    },
    docs: {
        title: 'Documentation - Developer Resources & Integration Guides',
        description: 'Complete documentation for integrating Uatu Security into your workflow. API reference, SDK guides, CI/CD integration, and security best practices.',
        keywords: ['api documentation', 'developer guide', 'integration', 'SDK', 'CI/CD security']
    },
    useCases: {
        title: 'Use Cases - Security Solutions for DeFi, NFTs & DAOs',
        description: 'Real-world security solutions for DeFi protocols, NFT marketplaces, DAOs, bridges, and blockchain applications. See how leading teams protect their code.',
        keywords: ['defi security', 'nft audit', 'dao security', 'bridge security', 'protocol audit']
    },
    about: {
        title: 'About Us - The Team Behind Uatu Security',
        description: 'Meet the security experts and AI researchers building the future of Web3 security. Our mission: make blockchain safer for everyone.',
        keywords: ['about uatu', 'security team', 'web3 security company', 'blockchain security experts']
    },
    dashboard: {
        title: 'Dashboard - Your Security Command Center',
        description: 'Manage your security audits, view detailed reports, track vulnerabilities, and monitor your projects in one unified dashboard.',
        keywords: ['security dashboard', 'audit management', 'vulnerability tracking']
    },
    quickScan: {
        title: 'Quick Scan - Free Instant Smart Contract Security Check',
        description: 'Get a free instant security scan of any verified smart contract. Enter a contract address and receive AI-powered vulnerability analysis in minutes.',
        keywords: ['free smart contract scan', 'instant security check', 'contract scanner', 'free audit']
    },
    publicAudits: {
        title: 'Public Audits - Security Transparency Ledger',
        description: 'Browse public smart contract security audits. View vulnerability reports, security scores, and audit history for verified contracts.',
        keywords: ['public audits', 'security ledger', 'audit history', 'transparency']
    }
};

export default function SEO({
    title,
    description = defaults.description,
    image = defaults.image,
    type = 'website',
    url,
    keywords = [],
    noindex = false,
    publishedTime,
    modifiedTime
}: SEOProps) {
    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : defaults.siteUrl);
    const canonicalUrl = currentUrl.split('?')[0]; // Remove query params for canonical
    const fullTitle = title
        ? `${title} | ${defaults.siteName}`
        : `${defaults.siteName} | ${defaults.title}`;
    const allKeywords = [...new Set([...defaults.keywords, ...keywords])];

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />
            <meta name="keywords" content={allKeywords.join(', ')} />
            {noindex && <meta name="robots" content="noindex, nofollow" />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${defaults.siteName} - ${title || defaults.title}`} />
            <meta property="og:site_name" content={defaults.siteName} />
            <meta property="og:locale" content="en_US" />
            {publishedTime && <meta property="article:published_time" content={publishedTime} />}
            {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={currentUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:image:alt" content={`${defaults.siteName} - ${title || defaults.title}`} />
            <meta name="twitter:creator" content={defaults.twitterHandle} />
            <meta name="twitter:site" content={defaults.twitterHandle} />

            {/* Canonical URL */}
            <link rel="canonical" href={canonicalUrl} />
        </Helmet>
    );
}

// Export defaults for use in other components
export { defaults as seoDefaults };
