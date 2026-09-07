'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtjehqjnazsxvdzqtkgh.supabase.co';
const supabaseAnonKey = 'sb_publishable_sqVY-eC8omT648v-K5hiUw_u03LW-3r';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('general');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchTag, setSearchTag] = useState('');

  // Post creation state
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    fetchPosts();

    return () => subscription.unsubscribe();
  }, []);

  // Fetch posts from Supabase database
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please enter both an email and password.');
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Account created! You can now sign in.');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please enter both an email and password.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Upload Video Handler
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !user) {
      alert('Please select a video file and ensure you are logged in.');
      return;
    }

    try {
      setUploading(true);

      // 1. Upload video file to Supabase Storage Bucket ('videos')
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL of uploaded video
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      const videoUrl = publicUrlData.publicUrl;

      // 3. Insert record into 'posts' database table
      const { error: insertError } = await supabase
        .from('posts')
        .insert([{ user_id: user.id, video_url: videoUrl, caption }]);

      if (insertError) throw insertError;

      alert('Post created successfully!');
      setCaption('');
      setFile(null);
      fetchPosts(); // Refresh feed
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>KINETIX</h1>
        {user && <button onClick={handleSignOut} style={styles.signOutBtn}>Logout</button>}
      </header>

      <main style={styles.mainContent}>
        {/* ROOM 1: GENERAL FEED */}
        {activeTab === 'general' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>General Feed</h2>

            {/* Video Upload Form for Logged In Users */}
            {user ? (
              <form onSubmit={handleUpload} style={styles.uploadCard}>
                <h3>Create a Post</h3>
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={(e) => setFile(e.target.files[0])} 
                  style={styles.fileInput}
                  required
                />
                <input 
                  type="text" 
                  placeholder="Write a caption... #hashtag" 
                  value={caption} 
                  onChange={(e) => setCaption(e.target.value)} 
                  style={styles.input} 
                />
                <button type="submit" disabled={uploading} style={styles.primaryBtn}>
                  {uploading ? 'Uploading...' : 'Post Video'}
                </button>
              </form>
            ) : (
              <div style={styles.noticeBox}>
                <p>Log in from the Profile tab to post videos!</p>
              </div>
            )}

            {/* Display Video Posts */}
            {posts.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center' }}>No posts yet. Be the first to share!</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} style={styles.feedCard}>
                  <video src={post.video_url} controls style={styles.videoPlayer} />
                  <p style={{ marginTop: '8px' }}>{post.caption}</p>
                </div>
              ))
            )}
          </section>
        )}

        {/* ROOM 2: HASHTAG SEARCH */}
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

        {/* ROOM 3: DIRECT MESSAGES */}
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

        {/* ROOM 4: PROFILE */}
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
  feedCard: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column' },
  uploadCard: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  videoPlayer: { width: '100%', borderRadius: '6px', maxHeight: '400px', backgroundColor: '#000' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  fileInput: { color: '#94a3b8' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  primaryBtn: { backgroundColor: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#334155', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' },
  noticeBox: { padding: '12px', backgroundColor: '#1e293b', borderRadius: '6px', textAlign: 'center', color: '#94a3b8' },
  chatBox: { padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px', textAlign: 'center', color: '#94a3b8' },
  navDock: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #1e293b' },
  tab: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' },
  activeTab: { background: 'none', border: 'none', color: '#22c55e', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
};
