import React from 'react';
import { createRoot } from 'react-dom/client';

function HomePage() {
  return (
    <div className="container">
      <div className="hero">
        <h2>Breaking: Tech Industry Sees Major Shift</h2>
        <p>
          Artificial intelligence continues to reshape how we work and live.
          Industry leaders predict unprecedented changes in the coming decade.
        </p>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Latest Articles</h2>
      <div className="article-grid">
        <div className="article-card">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23667eea' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' font-size='20' fill='white' text-anchor='middle' dominant-baseline='middle'%3ETech News%3C/text%3E%3C/svg%3E" alt="Tech" />
          <div className="content">
            <h3>AI Revolution in Healthcare</h3>
            <p>
              New machine learning models are helping doctors diagnose diseases
              with unprecedented accuracy.
            </p>
            <div className="meta">2 hours ago • Technology</div>
          </div>
        </div>

        <div className="article-card">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%2334d399' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' font-size='20' fill='white' text-anchor='middle' dominant-baseline='middle'%3EBusiness%3C/text%3E%3C/svg%3E" alt="Business" />
          <div className="content">
            <h3>Markets Rally on Economic Data</h3>
            <p>
              Strong employment numbers and consumer confidence drive stocks
              to new highs this quarter.
            </p>
            <div className="meta">4 hours ago • Business</div>
          </div>
        </div>

        <div className="article-card">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23f472b6' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' font-size='20' fill='white' text-anchor='middle' dominant-baseline='middle'%3EScience%3C/text%3E%3C/svg%3E" alt="Science" />
          <div className="content">
            <h3>Climate Research Breakthrough</h3>
            <p>
              Scientists develop new carbon capture technology that could help
              reverse global warming trends.
            </p>
            <div className="meta">6 hours ago • Science</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryPage() {
  return (
    <div className="container">
      <article style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '3rem 2rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
            FEATURED STORY
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            The Future of Remote Work: A Paradigm Shift
          </h1>
          <div style={{ opacity: 0.9 }}>
            By Sarah Johnson • 8 min read • Published 1 hour ago
          </div>
        </div>

        <div style={{ lineHeight: '1.8', fontSize: '1.1rem' }}>
          <p style={{ marginBottom: '1.5rem' }}>
            As we navigate through 2024, the landscape of work continues to evolve
            at an unprecedented pace. What started as a necessity during the global
            pandemic has transformed into a fundamental shift in how organizations
            operate and how employees engage with their work.
          </p>

          <h2 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#2c3e50' }}>
            The New Normal
          </h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Recent studies show that 70% of companies have adopted hybrid or fully
            remote work models. This isn't just a trend—it's a complete reimagining
            of the traditional office environment. Companies are discovering that
            flexibility isn't just a perk; it's a competitive advantage.
          </p>

          <h2 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#2c3e50' }}>
            Technology as the Enabler
          </h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Advanced collaboration tools, AI-powered productivity platforms, and
            virtual reality meeting spaces are making remote work more seamless
            than ever. The technology that once felt novel is now integral to
            daily operations.
          </p>

          <blockquote style={{
            borderLeft: '4px solid #e74c3c',
            paddingLeft: '1.5rem',
            margin: '2rem 0',
            fontStyle: 'italic',
            color: '#666'
          }}>
            "The office of the future isn't a place—it's a state of mind. It's
            about being connected, productive, and engaged, regardless of your
            physical location."
          </blockquote>

          <h2 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#2c3e50' }}>
            Looking Ahead
          </h2>
          <p style={{ marginBottom: '1.5rem' }}>
            As we look to the future, one thing is clear: the traditional
            9-to-5 office model is becoming a relic of the past. The companies
            that will thrive are those that embrace flexibility, invest in
            technology, and trust their employees to work in ways that suit
            them best.
          </p>
        </div>

        <div style={{
          background: '#f8f9fa',
          padding: '1.5rem',
          borderRadius: '8px',
          marginTop: '3rem'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>Read More</h3>
          <a href="/" style={{ color: '#e74c3c', textDecoration: 'none' }}>
            ← Back to Homepage
          </a>
        </div>
      </article>
    </div>
  );
}

// Determine which page to render based on URL
const pathname = window.location.pathname;
const root = createRoot(document.getElementById('app')!);

if (pathname === '/story') {
  root.render(<StoryPage />);
} else {
  root.render(<HomePage />);
}
