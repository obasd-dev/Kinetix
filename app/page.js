'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtjehqjnazsxvdzqtkgh.supabase.co';
const supabaseAnonKey = 'sb_publishable_sqVY-eC8omT648v-K5hiUw_u03LW-3r';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState(null);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile Setup State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Post & Article Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postType, setPostType] = useState('media'); // 'media' or 'article'
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // Feed & Search State
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileSubTab, setProfileSubTab] = useState('posts');

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

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  // Auth Handlers
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Account created! You can now sign in.');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowSettingsMenu(false);
  };

  // Profile Save Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username, bio, website, updated_at: new Date() });

    if (error) alert(error.message);
    else alert('Profile updated successfully!');
  };

  // Create Post / Article Handler
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) return alert('You must be logged in.');

    try {
      setUploading(true);
      let mediaUrl = '';

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName);

        mediaUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          video_url: mediaUrl,
          caption,
          post_type: postType
        }]);

      if (insertError) throw insertError;

      alert(`${postType === 'article' ? 'Article' : 'Post'} published!`);
      setCaption('');
      setFile(null);
      setShowCreateModal(false);
      fetchPosts();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const filteredPosts = posts.filter(p => 
    p.caption?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>KINETIX</h1>
      </header>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* 1. HOME TAB (Global Feed) */}
        {activeTab === 'home' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Home Feed</h2>
            {posts.length === 0 ? (
              <p style={styles.emptyText}>No posts yet. Be the first to share!</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} style={styles.feedCard}>
                  {post.post_type === 'article' ? (
                    <div style={styles.articleBadge}>Article</div>
                  ) : null}
                  
                  {post.video_url && (
                    <video src={post.video_url} controls style={styles.videoPlayer} />
                  )}
                  
                  <p style={styles.captionText}>{post.caption}</p>

                  {/* Social Interactions */}
                  <div style={styles.interactionRow}>
                    <button style={styles.actionBtn}>❤️ Like</button>
                    <button style={styles.actionBtn}>💬 Comment</button>
                    <button style={styles.actionBtn}>🔄 Repost</button>
                    <button style={styles.actionBtn}>🔗 Share</button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* 2. SEARCH TAB (Profiles & Hashtags) */}
        {activeTab === 'search' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Search Profiles & Content</h2>
            <input 
              type="text" 
              placeholder="Search @usernames, #hashtags, or posts..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.input}
            />
            
            <div style={{ marginTop: '15px' }}>
              <h3>Results</h3>
              {filteredPosts.map(post => (
                <div key={post.id} style={styles.feedCard}>
                  <p>{post.caption}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. CHATS TAB */}
        {activeTab === 'dms' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Direct Messages</h2>
            {!user ? (
              <p style={styles.emptyText}>Please log in to chat with mutual connections.</p>
            ) : (
              <div style={styles.chatBox}>
                <p><em>Select a connection to start messaging...</em></p>
              </div>
            )}
          </section>
        )}

        {/* 4. PROFILE TAB */}
        {activeTab === 'profile' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Profile & Setup</h2>

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
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSignIn} style={styles.primaryBtn}>Sign In</button>
                  <button onClick={handleSignUp} style={styles.secondaryBtn}>Sign Up</button>
                </div>
              </form>
            ) : (
              <div>
                {/* Profile Setup Box */}
                <form onSubmit={handleSaveProfile} style={styles.profileBox}>
                  <h3>Edit Profile Details</h3>
                  <input 
                    type="text" 
                    placeholder="Username (@username)" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    style={styles.input} 
                  />
                  <textarea 
                    placeholder="Bio (max 200 characters)" 
                    maxLength={200}
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    style={{ ...styles.input, height: '70px' }} 
                  />
                  <small style={{ color: '#94a3b8', alignSelf: 'flex-end' }}>{bio.length}/200</small>
                  
                  <input 
                    type="url" 
                    placeholder="Website Link (optional)" 
                    value={website} 
                    onChange={(e) => setWebsite(e.target.value)} 
                    style={styles.input} 
                  />
                  <button type="submit" style={styles.primaryBtn}>Save Profile</button>
                </form>

                {/* Sub-tab Switcher: Posts vs Articles */}
                <div style={styles.subTabRow}>
                  <button 
                    onClick={() => setProfileSubTab('posts')}
                    style={profileSubTab === 'posts' ? styles.activeSubTab : styles.subTab}
                  >
                    My Posts
                  </button>
                  <button 
                    onClick={() => setProfileSubTab('articles')}
                    style={profileSubTab === 'articles' ? styles.activeSubTab : styles.subTab}
                  >
                    My Articles
                  </button>
                </div>

                {/* User Content Feed */}
                {posts
                  .filter(p => p.user_id === user.id && (profileSubTab === 'articles' ? p.post_type === 'article' : p.post_type !== 'article'))
                  .map(post => (
                    <div key={post.id} style={styles.feedCard}>
                      {post.video_url && <video src={post.video_url} controls style={styles.videoPlayer} />}
                      <p>{post.caption}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Unique Settings Option: Bottom Left Corner Button */}
            {user && (
              <div style={styles.bottomLeftMenuWrapper}>
                <button 
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)} 
                  style={styles.threeDotBtn}
                >
                  ⋮
                </button>
                {showSettingsMenu && (
                  <div style={styles.settingsDropdown}>
                    <button onClick={handleSignOut} style={styles.dangerBtn}>Log Out</button>
                  </div>
                )}
              </div>
            )}

            {/* Create Post Action Button (Bottom Center of Profile) */}
            {user && (
              <div style={styles.createPostContainer}>
                <button onClick={() => setShowCreateModal(true)} style={styles.createPostBtn}>
                  ➕ Create Post
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Creation Modal (Post or 500-char Article) */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Publish Content</h3>
              <button onClick={() => setShowCreateModal(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', margin: '10px 0' }}>
              <button 
                onClick={() => setPostType('media')} 
                style={postType === 'media' ? styles.primaryBtn : styles.secondaryBtn}
              >
                Media Post
              </button>
              <button 
                onClick={() => setPostType('article')} 
                style={postType === 'article' ? styles.primaryBtn : styles.secondaryBtn}
              >
                Article (500 Chars)
              </button>
            </div>

            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea 
                placeholder={postType === 'article' ? "Write your article content (max 500 characters)..." : "Write a caption..."}
                maxLength={postType === 'article' ? 500 : 2200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{ ...styles.input, height: postType === 'article' ? '120px' : '70px' }}
                required
              />
              {postType === 'article' && (
                <small style={{ color: '#94a3b8', textAlign: 'right' }}>{caption.length}/500</small>
              )}

              <input 
                type="file" 
                accept="video/*,image/*" 
                onChange={(e) => setFile(e.target.files[0])} 
                style={styles.fileInput}
              />

              <button type="submit" disabled={uploading} style={styles.primaryBtn}>
                {uploading ? 'Publishing...' : 'Publish'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Navigation Dock */}
      <nav style={styles.navDock}>
        <button onClick={() => setActiveTab('home')} style={activeTab === 'home' ? styles.activeTab : styles.tab}>Home</button>
        <button onClick={() => setActiveTab('search')} style={activeTab === 'search' ? styles.activeTab : styles.tab}>Search</button>
        <button onClick={() => setActiveTab('dms')} style={activeTab === 'dms' ? styles.activeTab : styles.tab}>Chats</button>
        <button onClick={() => setActiveTab('profile')} style={activeTab === 'profile' ? styles.activeTab : styles.tab}>Profile</button>
      </nav>
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '90px', fontFamily: 'sans-serif', position: 'relative' },
  header: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #1e293b' },
  logo: { fontSize: '22px', fontWeight: 'bold', letterSpacing: '2px', color: '#22c55e' },
  mainContent: { padding: '20px', maxWidth: '500px', margin: '0 auto' },
  roomContainer: { display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' },
  roomTitle: { fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '8px' },
  feedCard: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' },
  videoPlayer: { width: '100%', borderRadius: '6px', maxHeight: '350px', backgroundColor: '#000' },
  captionText: { fontSize: '14px', lineHeight: '1.4' },
  interactionRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '10px', marginTop: '5px' },
  actionBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  fileInput: { color: '#94a3b8' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  profileBox: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' },
  primaryBtn: { backgroundColor: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  secondaryBtn: { backgroundColor: '#334155', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', flex: 1 },
  dangerBtn: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: '20px' },
  chatBox: { padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px', textAlign: 'center', color: '#94a3b8' },
  subTabRow: { display: 'flex', gap: '10px', marginBottom: '15px' },
  subTab: { background: 'none', border: 'none', color: '#64748b', padding: '8px', cursor: 'pointer', flex: 1, borderBottom: '2px solid transparent' },
  activeSubTab: { background: 'none', border: 'none', color: '#22c55e', padding: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold', borderBottom: '2px solid #22c55e' },
  articleBadge: { alignSelf: 'flex-start', backgroundColor: '#3b82f6', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  
  // Custom Controls
  bottomLeftMenuWrapper: { position: 'fixed', bottom: '70px', left: '15px', zIndex: 50 },
  threeDotBtn: { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' },
  settingsDropdown: { position: 'absolute', bottom: '45px', left: 0, backgroundColor: '#0f172a', border: '1px solid #334155', padding: '8px', borderRadius: '6px', width: '100px' },
  createPostContainer: { display: 'flex', justifyContent: 'center', margin: '20px 0' },
  createPostBtn: { backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },

  // Navigation Dock
  navDock: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #1e293b', zIndex: 40 },
  tab: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' },
  activeTab: { background: 'none', border: 'none', color: '#22c55e', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }
};
