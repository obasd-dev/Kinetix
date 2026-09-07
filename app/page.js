'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('general');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchTag, setSearchTag] = useState('');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for the confirmation link!');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>KINETIX</h1>
        {user && <button onClick={handleSignOut} style={styles.signOutBtn}>Logout</button>}
      </header>

      <main style={styles.mainContent}>
        {activeTab === 'general' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>General Feed</h2>
            <div style={styles.feedCard}>
              <p><strong>@creator_one</strong></p>
              <div style={styles.videoPlaceholder}>[ Video Clip Placeholder ]</div>
              <p>Testing out the new Kinetix general feed! 🔥</p>
            </div>
          </section>
        )}

        {activeTab === 'hashtags' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Hashtag Search</h2>
            <input 
              type="text" 
              placeholder="Search hashtags (e.g. #tech)..." 
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
              style={styles.input}
            />
            <p style={{ marginTop: '10px' }}>Showing posts indexed for: <strong>{searchTag || 'All'}</strong></p>
          </section>
        )}

        {activeTab === 'dms' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Direct Messages</h2>
            {!user ? (
              <p>Please log in to chat with mutual followers.</p>
            ) : (
              <div style={styles.chatBox}>
                <p><em>Select a mutual connection to start chatting...</em></p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'profile' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Profile & Account</h2>
            {!user ? (
              <form style={styles.authForm}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  style={styles.input} 
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  style={styles.input} 
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={handleSignIn} style={styles.primaryBtn}>Sign In</button>
                  <button onClick={handleSignUp} style={styles.secondaryBtn}>Sign Up</button>
                </div>
              </form>
            ) : (
              <div>
                <p>Logged in as: <strong>{user.email}</strong></p>
                <p>User ID: <code>{user.id}</code></p>
              </div>
            )}
          </section>
        )}
      </main>

      <nav style={styles.navDock}>
        <button onClick={() => setActiveTab('general')} style={activeTab === 'general' ? styles.activeTab : styles.tab}>Feed</button>
        <button onClick={() => setActiveTab('hashtags')} style={activeTab === 'hashtags' ? styles.activeTab : styles.tab}>Search</button>
        <button onClick={() => setActiveTab('dms')} style={activeTab === 'dms' ? styles.activeTab : styles.tab}>Chats</button>
        <button onClick={() => setActiveTab('profile')} style={activeTab === 'profile' ? styles.activeTab : styles.tab}>Profile</button>
      </nav>
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '70px', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #1e293b' },
  logo: { fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', color: '#22c55e' },
  signOutBtn: { background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' },
  mainContent: { padding: '20px', maxWidth: '500px', margin: '0 auto' },
  roomContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
  roomTitle: { fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '8px' },
  feedCard: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  videoPlaceholder: { height: '250px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: '#94a3b8' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', boxSizing: 'border-box' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  primaryBtn: { flex: 1, backgroundColor: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { flex: 1, backgroundColor: '#334155', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' },
  chatBox: { padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px', textAlign: 'center', color: '#94a3b8' },
  navDock: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #1e293b' },
  tab: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' },
  activeTab: { background: 'none', border: 'none', color: '#22c55e', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
};
