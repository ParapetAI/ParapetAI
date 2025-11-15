import type { FC } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  title?: string;
  id?: string;
}

const FAQ: FC<FAQProps> = ({ items, title = 'Frequently Asked Questions', id = 'faq' }) => {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <section id={id} className="mt-16 sm:mt-24">
      <h2 className="text-2xl font-semibold text-text">{title}</h2>
      <div className="mt-6 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-none border-[3px] border-border bg-surface p-5 shadow-md">
            <h3 className="text-base font-semibold text-text">{item.question}</h3>
            <p className="mt-2 text-sm text-muted">{item.answer}</p>
          </div>
        ))}
      </div>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </section>
  );
};

export default FAQ;

