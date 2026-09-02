// Dynamic route for viewing landing pages: /v/[id]
// This renders the personalized landing pages created with GrapesJS

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

const LandingPageViewer = () => {
  const router = useRouter();
  const { id } = router.query;
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      loadLandingPage(id);
    }
  }, [id]);

  const loadLandingPage = async (pageId) => {
    try {
      setLoading(true);
      // In production, this would fetch from a database or API
      // For now, we'll create a mock landing page for demonstration

      // Mock data - replace with actual database fetch
      const mockPageData = {
        id: pageId,
        title: 'Personalized Video Message',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <header style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 32px;">Personal Message</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Just for you!</p>
            </header>

            <div style="text-align: center; margin-bottom: 30px;">
              <video controls poster="/api/placeholder/400/225" style="width: 100%; max-width: 500px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <source src="/api/placeholder-video" type="video/mp4">
                Your browser does not support the video tag.
              </video>
            </div>

            <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
              <h2 style="margin-top: 0; color: #333;">Thank you for watching!</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 20px;">
                This video was personalized just for you. I hope you found it valuable.
              </p>
            </div>

            <div style="text-align: center;">
              <a href="https://calendly.com" style="display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 8px rgba(0,123,255,0.3);">
                Schedule a Call
              </a>
            </div>

            <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
              <p>Landing page ID: ${pageId}</p>
            </footer>
          </div>
        `,
        css: `
          body {
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          }

          h1 {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          video {
            border-radius: 8px;
          }

          .cta-button {
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,123,255,0.4);
          }

          @media (max-width: 600px) {
            body {
              padding: 10px;
            }

            .container {
              border-radius: 8px;
            }
          }
        `,
        contact: {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Inc',
          email: 'john@acme.com'
        },
        createdAt: new Date().toISOString()
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setPageData(mockPageData);
      setLoading(false);

    } catch (err) {
      console.error('Failed to load landing page:', err);
      setError('Failed to load landing page');
      setLoading(false);
    }
  };

  const replaceTokens = (content) => {
    if (!content || !pageData?.contact) return content;

    const contact = pageData.contact;
    return content
      .replace(/{{firstName}}/g, contact.firstName || 'there')
      .replace(/{{lastName}}/g, contact.lastName || '')
      .replace(/{{company}}/g, contact.company || 'your company')
      .replace(/{{email}}/g, contact.email || '')
      .replace(/{{videoUrl}}/g, pageData.videoUrl || '/api/placeholder-video')
      .replace(/{{thumbnail}}/g, pageData.thumbnail || '/api/placeholder/400/225');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading landing page...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ color: '#dc3545', marginBottom: '16px' }}>Error</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
        <button
          onClick={() => router.push('/personalize')}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ color: '#6c757d', marginBottom: '16px' }}>Page Not Found</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          The landing page you're looking for doesn't exist or has been removed.
        </p>
        <button
          onClick={() => router.push('/personalize')}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{pageData.title || 'Personalized Video'}</title>
        <meta name="description" content="A personalized video message just for you" />
        <meta property="og:title" content={pageData.title || 'Personalized Video'} />
        <meta property="og:description" content="A personalized video message just for you" />
        <meta property="og:type" content="website" />
        {pageData.thumbnail && (
          <meta property="og:image" content={pageData.thumbnail} />
        )}
        <style dangerouslySetInnerHTML={{ __html: pageData.css || '' }} />
      </Head>

      <div
        dangerouslySetInnerHTML={{
          __html: replaceTokens(pageData.html)
        }}
      />

      {/* Fallback for browsers that don't support dangerouslySetInnerHTML */}
      <noscript>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Personalized Video Landing Page</h1>
          <p>This page requires JavaScript to display properly.</p>
          <p>Please enable JavaScript and reload the page.</p>
        </div>
      </noscript>
    </>
  );
};

export default LandingPageViewer;