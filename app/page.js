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
  const [showPassword, setShowPassword] = useState(false);

  // Profile Setup State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Post & Article Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postType, setPostType] = useState('media');
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // Feed & Search State
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileSubTab, setProfileSubTab] = useState('posts');

  // Likes & Comments Interactive State
  const [userLikes, setUserLikes] = useState([]); // List of post IDs the logged-in user liked
  const [activeCommentPostId, setActiveCommentPostId] = useState(null); // Which post's comments are open
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');

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

  useEffect(() => {
    if (user) {
      fetchUserLikes();
      fetchUserProfile();
    } else {
      setUserLikes([]);
      setUsername('');
      setBio('');
      setWebsite('');
    }
  }, [user]);

  // Fetch saved user profile data
  const fetchUserProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('username, bio, website')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setUsername(data.username || '');
      setBio(data.bio || '');
      setWebsite(data.website || '');
    }
  };

  // Fetch all posts and count total likes/comments
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, likes(id), comments(id)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

  // Fetch posts liked by current user
  const fetchUserLikes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id);

    if (data) {
      setUserLikes(data.map(l => l.post_id));
    }
  };

  // ----------------------------------------------------
  // STEP 2 FUNCTIONS: LIKE & COMMENT HANDLERS
  // ----------------------------------------------------

  const handleLike = async (postId) => {
    if (!user) return alert('Please log in to like posts.');

    const isLiked = userLikes.includes(postId);

    if (isLiked) {
      // Remove Like
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      setUserLikes(prev => prev.filter(id => id !== postId));
    } else {
      // Add Like
      await supabase
        .from('likes')
        .insert([{ user_id: user.id, post_id: postId }]);

      setUserLikes(prev => [...prev, postId]);
    }

    fetchPosts(); // Refresh counters
  };

  const handleOpenComments = async (postId) => {
    setActiveCommentPostId(postId);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) setComments(data);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please log in to comment.');
    if (!newCommentText.trim()) return;

    const { error } = await supabase
      .from('comments')
      .insert([{ user_id: user.id, post_id: activeCommentPostId, content: newCommentText }]);

    if (error) {
      alert(error.message);
    } else {
      setNewCommentText('');
      handleOpenComments(activeCommentPostId); // Refresh comments in popup
      fetchPosts(); // Refresh comment count on post feed
    }
  };

  // ----------------------------------------------------
  // AUTH HANDLERS
  // ----------------------------------------------------

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
    } else if (data?.session) {
      // Confirmation is disabled; user logged in immediately
      alert('Account created and logged in!');
      setEmail('');
      setPassword('');
    } else {
      // Email confirmation requirement is enabled
      alert('Account created! Please check your email inbox (and spam) to confirm your account before signing in.');
      setEmail('');
      setPassword('');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else {
      setEmail('');
      setPassword('');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowSettingsMenu(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username, bio, website, updated_at: new Date() });

    if (error) alert(error.message);
    else alert('Profile updated successfully!');
  };

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
      <header style={styles.header}>
        <h1 style={styles.logo}>KINETIX</h1>
      </header>

      <main style={styles.mainContent}>
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Home Feed</h2>
            {posts.length === 0 ? (
              <p style={styles.emptyText}>No posts yet. Be the first to share!</p>
            ) : (
              posts.map((post) => {
                const isLiked = userLikes.includes(post.id);
                const likeCount = post.likes ? post.likes.length : 0;
                const commentCount = post.comments ? post.comments.length : 0;

                return (
                  <div key={post.id} style={styles.feedCard}>
                    {post.post_type === 'article' && (
                      <div style={styles.articleBadge}>Article</div>
                    )}
                    
                    {post.video_url && (
                      <video src={post.video_url} controls style={styles.videoPlayer} />
                    )}
                    
                    <p style={styles.captionText}>{post.caption}</p>

                    {/* Social Interaction Bar */}
                    <div style={styles.interactionRow}>
                      <button 
                        onClick={() => handleLike(post.id)} 
                        style={{ ...styles.actionBtn, color: isLiked ? '#ef4444' : '#94a3b8' }}
                      >
                        {isLiked ? '❤️' : '🤍'} {likeCount}
                      </button>

                      <button 
                        onClick={() => handleOpenComments(post.id)} 
                        style={styles.actionBtn}
                      >
                        💬 {commentCount}
                      </button>

                      <button style={styles.actionBtn}>🔄 Share</button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* SEARCH TAB */}
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

        {/* CHATS TAB */}
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

        {/* PROFILE TAB */}
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
                
                {/* Password Input with Eye Toggle */}
                <div style={styles.passwordWrapper}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    style={styles.passwordInput} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    style={styles.eyeBtn}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={handleSignIn} style={styles.primaryBtn}>Sign In</button>
                  <button type="button" onClick={handleSignUp} style={styles.secondaryBtn}>Sign Up</button>
                </div>
              </form>
            ) : (
              <div>
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

      {/* COMMENTS MODAL */}
      {activeCommentPostId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Comments</h3>
              <button onClick={() => setActiveCommentPostId(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.commentsList}>
              {comments.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>No comments yet. Write the first one!</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={styles.commentItem}>
                    <p style={{ margin: 0, fontSize: '13px' }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Write a comment..." 
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.primaryBtn}>Send</button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
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

      {/* NAV DOCK */}
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
  interactionRow: { display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #334155', paddingTop: '10px', marginTop: '5px' },
  actionBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  fileInput: { color: '#94a3b8' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  passwordWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  passwordInput: { width: '100%', padding: '10px', paddingRight: '40px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '0' },
  profileBox: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' },
  primaryBtn: { backgroundColor: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#334155', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' },
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
  
  // Modal & Comments
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  commentsList: { maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' },
  commentItem: { backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' },

  // Nav Dock
  navDock: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #1e293b', zIndex: 40 },
  tab: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' },
  activeTab: { background: 'none', border: 'none', color: '#22c55e', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }
};
