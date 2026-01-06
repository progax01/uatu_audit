import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    type?: 'website' | 'article';
    url?: string;
    keywords?: string[];
}

// Default SEO configuration
const defaults = {
    siteName: 'Uatu Security',
    title: 'AI-Powered Smart Contract Audits & Web3 Security',
    description: 'Enterprise-grade AI security audits for smart contracts and DApps. Detect vulnerabilities before deployment with 99.8% accuracy. Trusted by leading Web3 protocols.',
    image: 'https://audit.uatu.xyz/og-image.png',
    keywords: [
        'smart contract audit',
        'blockchain security',
        'solidity audit',
        'defi security',
        'web3 security',
        'ethereum audit',
        'AI security',
        'vulnerability detection',
        'code review',
        'crypto security'
    ],
    siteUrl: 'https://audit.uatu.xyz'
};

// Page-specific SEO configurations
export const pageSEO = {
    home: {
        title: 'AI-Powered Smart Contract Audits & Web3 Security',
        description: 'Enterprise-grade AI security audits for smart contracts and DApps. Detect vulnerabilities before deployment with 99.8% accuracy. Trusted by leading Web3 protocols.',
    },
    features: {
        title: 'Features - Advanced Security Analysis Tools',
        description: 'Discover Uatu\'s cutting-edge security features: AI-powered vulnerability detection, real-time monitoring, automated code review, and comprehensive audit reports.',
        keywords: ['security features', 'vulnerability scanner', 'automated audit', 'code analysis']
    },
    pricing: {
        title: 'Pricing - Flexible Plans for Every Team',
        description: 'Transparent pricing for smart contract audits. From startups to enterprises, find the perfect security plan. Free tier available.',
        keywords: ['audit pricing', 'security cost', 'smart contract audit cost']
    },
    howItWorks: {
        title: 'How It Works - Simple 3-Step Security Process',
        description: 'Get your smart contracts audited in minutes. Connect your repo, run AI analysis, and receive comprehensive security reports with actionable insights.',
        keywords: ['how to audit', 'security process', 'audit workflow']
    },
    supportedChains: {
        title: 'Supported Chains - Multi-Chain Security Coverage',
        description: 'Comprehensive security audits for Ethereum, Solana, Polygon, Arbitrum, Base, and 20+ blockchain networks. Multi-chain expertise.',
        keywords: ['ethereum audit', 'solana audit', 'polygon security', 'multi-chain']
    },
    docs: {
        title: 'Documentation - Developer Resources & Guides',
        description: 'Complete documentation for integrating Uatu Security into your workflow. API reference, SDK guides, and security best practices.',
        keywords: ['api documentation', 'developer guide', 'integration']
    },
    useCases: {
        title: 'Use Cases - Security Solutions for Web3',
        description: 'Real-world security solutions for DeFi protocols, NFT marketplaces, DAOs, and blockchain applications. See how teams protect their code.',
        keywords: ['defi security', 'nft audit', 'dao security']
    },
    about: {
        title: 'About Us - The Team Behind Uatu Security',
        description: 'Meet the security experts and AI researchers building the future of Web3 security. Our mission: make blockchain safer for everyone.',
        keywords: ['about uatu', 'security team', 'company']
    },
    dashboard: {
        title: 'Dashboard - Your Security Command Center',
        description: 'Manage your security audits, view reports, and monitor vulnerabilities in one place.',
    }
};

export default function SEO({
    title,
    description = defaults.description,
    image = defaults.image,
    type = 'website',
    url,
    keywords = []
}: SEOProps) {
    const siteUrl = url || (typeof window !== 'undefined' ? window.location.href : defaults.siteUrl);
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

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={siteUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content={defaults.siteName} />

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
