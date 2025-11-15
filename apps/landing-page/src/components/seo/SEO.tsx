import type { FC } from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  structuredData?: object | object[];
}

const SEO: FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://parapetai.com/og-image.png',
  structuredData,
}) => {
  const fullTitle = title.includes('Parapet') ? title : `${title} | ParapetAI`;
  const canonicalUrl = canonical || `https://parapetai.com${typeof window !== 'undefined' ? window.location.pathname : ''}`;
  const siteUrl = 'https://parapetai.com';

  const structuredDataArray = Array.isArray(structuredData) ? structuredData : structuredData ? [structuredData] : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="ParapetAI" />
      {ogImage && <meta property="og:image" content={ogImage} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {structuredDataArray.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;

