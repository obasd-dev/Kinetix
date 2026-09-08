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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Post & Article Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postType, setPostType] = useState('media');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // Feed & Search State
  const [posts, setPosts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all'); // 'all' | 'profiles' | 'hashtags' | 'videos' | 'articles'
  const [profileSubTab, setProfileSubTab] = useState('posts');

  // Likes & Comments Interactive State
  const [userLikes, setUserLikes] = useState([]);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
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
    fetchProfiles();
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    if (!error && data) {
      setProfiles(data);
    }
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, likes(id), comments(id), profiles(username)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
  };

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

  const handleLike = async (postId) => {
    if (!user) return alert('Please log in to like posts.');

    const isLiked = userLikes.includes(postId);

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      setUserLikes(prev => prev.filter(id => id !== postId));
    } else {
      await supabase
        .from('likes')
        .insert([{ user_id: user.id, post_id: postId }]);

      setUserLikes(prev => [...prev, postId]);
    }

    fetchPosts();
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
      handleOpenComments(activeCommentPostId);
      fetchPosts();
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
    } else if (data?.session) {
      alert('Account created and logged in!');
      setEmail('');
      setPassword('');
    } else {
      alert('Account created! Please check your email inbox to confirm your account.');
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
    else {
      alert('Profile updated successfully!');
      setIsEditingProfile(false);
      fetchProfiles();
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
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
      setPreviewUrl(null);
      setShowCreateModal(false);
      fetchPosts();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Extract Hashtags Helper
  const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  };

  // Gather system-wide hashtag analytics
  const getAllHashtags = () => {
    const tagCounts = {};
    posts.forEach(post => {
      const tags = extractHashtags(post.caption);
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  };

  const cleanedQuery = searchQuery.trim().toLowerCase();
  const isTagSearch = cleanedQuery.startsWith('#');
  const targetTag = isTagSearch ? cleanedQuery : `#${cleanedQuery}`;

  // Filtered Profiles
  const filteredProfiles = profiles.filter(p => 
    p.username?.toLowerCase().includes(cleanedQuery.replace('@', '')) ||
    p.bio?.toLowerCase().includes(cleanedQuery)
  );

  // Filtered Hashtags
  const matchingHashtags = getAllHashtags().filter(item => 
    item.tag.includes(cleanedQuery.replace('#', ''))
  );

  // Filtered Posts Logic (Matches Usernames, Captions, Hashtags, or Media Type)
  const filteredPosts = posts.filter(post => {
    const captionLower = (post.caption || '').toLowerCase();
    const usernameLower = (post.profiles?.username || '').toLowerCase();
    const postTags = extractHashtags(post.caption);
    const isVideo = post.video_url && post.video_url.match(/\.(mp4|webm|ogg)$/i);

    const matchesQuery = 
      captionLower.includes(cleanedQuery) ||
      usernameLower.includes(cleanedQuery.replace('@', '')) ||
      postTags.some(tag => tag.includes(cleanedQuery.replace('#', '')));

    if (!matchesQuery && cleanedQuery !== '') return false;

    if (searchCategory === 'videos') return isVideo;
    if (searchCategory === 'articles') return post.post_type === 'article';
    return true;
  });

  const userPosts = posts.filter(p => p.user_id === user?.id);

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
                    <div style={styles.feedCardHeader}>
                      <span style={styles.feedUsername}>@{post.profiles?.username || 'user'}</span>
                      {post.post_type === 'article' && (
                        <div style={styles.articleBadge}>Article</div>
                      )}
                    </div>
                    
                    {post.video_url && (
                      post.video_url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={post.video_url} controls style={styles.videoPlayer} />
                      ) : (
                        <img src={post.video_url} alt="Post media" style={styles.mediaImage} />
                      )
                    )}
                    
                    <p style={styles.captionText}>{post.caption}</p>

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

        {/* DISCOVERY & SEARCH MATRIX TAB */}
        {activeTab === 'search' && (
          <section style={styles.roomContainer}>
            <div style={styles.searchHeaderGroup}>
              <h2 style={styles.roomTitle}>Discovery Engine</h2>
              <div style={styles.searchInputWrapper}>
                <span style={styles.searchIcon}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Search @usernames, #hashtags, videos, posts..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>✕</button>
                )}
              </div>

              {/* SEARCH CATEGORY FILTER MATRIX */}
              <div style={styles.matrixCategoryRow}>
                {['all', 'profiles', 'hashtags', 'videos', 'articles'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSearchCategory(cat)}
                    style={searchCategory === cat ? styles.activeMatrixChip : styles.matrixChip}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* HASHTAG CLOUD / TRENDING MATRIX */}
            {(searchCategory === 'all' || searchCategory === 'hashtags') && matchingHashtags.length > 0 && (
              <div style={styles.hashtagSection}>
                <h4 style={styles.sectionHeading}>Matched Hashtags</h4>
                <div style={styles.hashtagCloud}>
                  {matchingHashtags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSearchQuery(tag);
                        setSearchCategory('all');
                      }}
                      style={styles.hashtagPill}
                    >
                      <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{tag}</span>
                      <span style={styles.hashtagBadge}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MATCHED PROFILES SECTION */}
            {(searchCategory === 'all' || searchCategory === 'profiles') && filteredProfiles.length > 0 && searchQuery && (
              <div style={styles.searchResultsGroup}>
                <h4 style={styles.sectionHeading}>Profiles</h4>
                <div style={styles.profileResultsGrid}>
                  {filteredProfiles.map((p) => (
                    <div key={p.id} style={styles.profileResultCard}>
                      <div style={styles.miniAvatar}>
                        {p.username ? p.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={styles.profileCardName}>@{p.username || 'user'}</div>
                        <div style={styles.profileCardBio}>{p.bio || 'No bio'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONTENT SEARCH RESULTS GRID */}
            {(searchCategory !== 'profiles' && searchCategory !== 'hashtags') && (
              <div style={styles.searchResultsGroup}>
                <h4 style={styles.sectionHeading}>Content Stream ({filteredPosts.length})</h4>
                {filteredPosts.length === 0 ? (
                  <p style={styles.emptyText}>No results match your search query.</p>
                ) : (
                  <div style={styles.searchGrid}>
                    {filteredPosts.map((post) => {
                      const postTags = extractHashtags(post.caption);
                      const isVideo = post.video_url && post.video_url.match(/\.(mp4|webm|ogg)$/i);

                      return (
                        <div key={post.id} style={styles.searchGridCard}>
                          <div style={styles.searchCardHeader}>
                            <span style={styles.searchAuthor}>@{post.profiles?.username || 'user'}</span>
                            {isVideo ? (
                              <span style={styles.typeBadgeVideo}>📹 VIDEO</span>
                            ) : post.post_type === 'article' ? (
                              <span style={styles.typeBadgeArticle}>📄 ARTICLE</span>
                            ) : (
                              <span style={styles.typeBadgeMedia}>📷 IMAGE</span>
                            )}
                          </div>

                          {post.video_url && (
                            isVideo ? (
                              <video src={post.video_url} style={styles.searchGridMedia} />
                            ) : (
                              <img src={post.video_url} alt="Media preview" style={styles.searchGridMedia} />
                            )
                          )}

                          <p style={styles.searchGridCaption}>{post.caption}</p>

                          {postTags.length > 0 && (
                            <div style={styles.searchGridTags}>
                              {postTags.map((tag) => (
                                <span 
                                  key={tag} 
                                  onClick={() => setSearchQuery(tag)} 
                                  style={styles.gridTagItem}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div style={styles.searchGridFooter}>
                            <span>❤️ {post.likes ? post.likes.length : 0}</span>
                            <span>💬 {post.comments ? post.comments.length : 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
            {!user ? (
              <div style={styles.authContainer}>
                <h2 style={styles.roomTitle}>Sign In / Sign Up</h2>
                <form style={styles.authForm}>
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    style={styles.input} 
                  />
                  
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
              </div>
            ) : (
              <div>
                {/* PROFESSIONAL CARD HEADER */}
                <div style={styles.proProfileCard}>
                  <div style={styles.proHeader}>
                    <div style={styles.avatarCircle}>
                      {username ? username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style={styles.proStatsRow}>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>{userPosts.length}</span>
                        <span style={styles.statLabel}>Posts</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>0</span>
                        <span style={styles.statLabel}>Followers</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>0</span>
                        <span style={styles.statLabel}>Following</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.proBioSection}>
                    <h3 style={styles.proUsername}>@{username || 'username'}</h3>
                    <p style={styles.proBioText}>{bio || 'No bio added yet.'}</p>
                    {website && (
                      <a href={website} target="_blank" rel="noreferrer" style={styles.proWebsite}>
                        🔗 {website}
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      onClick={() => setIsEditingProfile(!isEditingProfile)} 
                      style={styles.editProfileBtn}
                    >
                      {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
                    </button>
                  </div>

                  {isEditingProfile && (
                    <form onSubmit={handleSaveProfile} style={styles.profileBox}>
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
                      <input 
                        type="url" 
                        placeholder="Website Link (optional)" 
                        value={website} 
                        onChange={(e) => setWebsite(e.target.value)} 
                        style={styles.input} 
                      />
                      <button type="submit" style={styles.primaryBtn}>Save Changes</button>
                    </form>
                  )}
                </div>

                {/* SUB TABS */}
                <div style={styles.subTabRow}>
                  <button 
                    onClick={() => setProfileSubTab('posts')}
                    style={profileSubTab === 'posts' ? styles.activeSubTab : styles.subTab}
                  >
                    Posts ({userPosts.filter(p => p.post_type !== 'article').length})
                  </button>
                  <button 
                    onClick={() => setProfileSubTab('articles')}
                    style={profileSubTab === 'articles' ? styles.activeSubTab : styles.subTab}
                  >
                    Articles ({userPosts.filter(p => p.post_type === 'article').length})
                  </button>
                </div>

                {/* 3-COLUMN MEDIA GRID */}
                <div style={styles.mediaGrid}>
                  {userPosts
                    .filter(p => profileSubTab === 'articles' ? p.post_type === 'article' : p.post_type !== 'article')
                    .map(post => (
                      <div key={post.id} style={styles.gridItem}>
                        {post.video_url ? (
                          post.video_url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={post.video_url} style={styles.gridMedia} />
                          ) : (
                            <img src={post.video_url} alt="Media preview" style={styles.gridMedia} />
                          )
                        ) : (
                          <div style={styles.textTile}>{post.caption}</div>
                        )}
                      </div>
                    ))}
                </div>
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

      {/* CREATE POST MODAL WITH LIVE PREVIEW */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Publish Content</h3>
              <button onClick={() => { setShowCreateModal(false); setPreviewUrl(null); }} style={styles.closeBtn}>✕</button>
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
                Article
              </button>
            </div>

            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea 
                placeholder={postType === 'article' ? "Write your article content (max 500 characters)..." : "Write a caption with #hashtags..."}
                maxLength={postType === 'article' ? 500 : 2200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{ ...styles.input, height: postType === 'article' ? '100px' : '60px' }}
                required
              />

              {/* MEDIA PREVIEW SECTION */}
              {previewUrl && (
                <div style={styles.previewContainer}>
                  {file?.type.startsWith('video/') ? (
                    <video src={previewUrl} controls style={styles.previewMedia} />
                  ) : (
                    <img src={previewUrl} alt="Upload Preview" style={styles.previewMedia} />
                  )}
                </div>
              )}

              <input 
                type="file" 
                accept="video/*,image/*" 
                onChange={handleFileChange} 
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
        <button onClick={() => setActiveTab('search')} style={activeTab === 'search' ? styles.activeTab : styles.tab}>Discovery</button>
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
  roomTitle: { fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '8px', margin: 0 },
  feedCard: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' },
  feedCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  feedUsername: { fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' },
  videoPlayer: { width: '100%', borderRadius: '6px', maxHeight: '350px', backgroundColor: '#000' },
  mediaImage: { width: '100%', borderRadius: '6px', maxHeight: '350px', objectFit: 'cover' },
  captionText: { fontSize: '14px', lineHeight: '1.4' },
  interactionRow: { display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #334155', paddingTop: '10px', marginTop: '5px' },
  actionBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  input: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  fileInput: { color: '#94a3b8' },
  authContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  passwordWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  passwordInput: { width: '100%', padding: '10px', paddingRight: '40px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '0' },
  
  // Search & Discovery Styles
  searchHeaderGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
  searchInputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: '12px', fontSize: '14px', color: '#64748b' },
  searchInput: { width: '100%', padding: '12px 36px 12px 36px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', fontSize: '14px', boxSizing: 'border-box' },
  clearSearchBtn: { position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' },
  matrixCategoryRow: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' },
  matrixChip: { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' },
  activeMatrixChip: { backgroundColor: '#22c55e', border: '1px solid #22c55e', color: '#fff', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
  
  sectionHeading: { fontSize: '14px', color: '#94a3b8', margin: '10px 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  hashtagSection: { display: 'flex', flexDirection: 'column', gap: '6px' },
  hashtagCloud: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  hashtagPill: { backgroundColor: '#1e293b', border: '1px solid #334155', padding: '6px 10px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
  hashtagBadge: { backgroundColor: '#0f172a', color: '#94a3b8', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' },

  searchResultsGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  profileResultsGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  profileResultCard: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', border: '1px solid #334155' },
  miniAvatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#22c55e', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' },
  profileCardName: { fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' },
  profileCardBio: { fontSize: '11px', color: '#94a3b8' },

  searchGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  searchGridCard: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  searchCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  searchAuthor: { fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' },
  typeBadgeVideo: { fontSize: '10px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  typeBadgeArticle: { fontSize: '10px', color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  typeBadgeMedia: { fontSize: '10px', color: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  searchGridMedia: { width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', backgroundColor: '#000' },
  searchGridCaption: { fontSize: '13px', color: '#cbd5e1', lineHeight: '1.3' },
  searchGridTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  gridTagItem: { fontSize: '11px', color: '#22c55e', cursor: 'pointer' },
  searchGridFooter: { display: 'flex', gap: '15px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '8px' },

  // Profile Dashboard Styles
  proProfileCard: { backgroundColor: '#1e293b', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #334155' },
  proHeader: { display: 'flex', alignItems: 'center', gap: '16px' },
  avatarCircle: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#22c55e', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', fontWeight: 'bold' },
  proStatsRow: { display: 'flex', flex: 1, justifyContent: 'space-around', textAlign: 'center' },
  statBox: { display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' },
  statLabel: { fontSize: '11px', color: '#94a3b8' },
  proBioSection: { display: 'flex', flexDirection: 'column', gap: '4px' },
  proUsername: { fontSize: '16px', fontWeight: 'bold', margin: 0 },
  proBioText: { fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' },
  proWebsite: { fontSize: '12px', color: '#38bdf8', textDecoration: 'none' },
  editProfileBtn: { flex: 1, backgroundColor: '#334155', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  profileBox: { backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' },

  // Media Grid Styles
  mediaGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '10px' },
  gridItem: { aspectRatio: '1', backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  gridMedia: { width: '100%', height: '100%', objectFit: 'cover' },
  textTile: { fontSize: '10px', padding: '6px', color: '#94a3b8', textAlign: 'center', overflow: 'hidden' },

  // Live File Preview Styles
  previewContainer: { width: '100%', maxHeight: '180px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  previewMedia: { width: '100%', maxHeight: '180px', objectFit: 'contain' },

  primaryBtn: { backgroundColor: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#334155', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer' },
  dangerBtn: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: '10px', fontSize: '13px' },
  chatBox: { padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px', textAlign: 'center', color: '#94a3b8' },
  subTabRow: { display: 'flex', gap: '10px', marginTop: '15px' },
  subTab: { background: 'none', border: 'none', color: '#64748b', padding: '8px', cursor: 'pointer', flex: 1, borderBottom: '2px solid transparent' },
  activeSubTab: { background: 'none', border: 'none', color: '#22c55e', padding: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold', borderBottom: '2px solid #22c55e' },
  articleBadge: { backgroundColor: '#3b82f6', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  
  bottomLeftMenuWrapper: { position: 'fixed', bottom: '70px', left: '15px', zIndex: 50 },
  threeDotBtn: { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' },
  settingsDropdown: { position: 'absolute', bottom: '45px', left: 0, backgroundColor: '#0f172a', border: '1px solid #334155', padding: '8px', borderRadius: '6px', width: '100px' },
  createPostContainer: { display: 'flex', justifyContent: 'center', margin: '20px 0' },
  createPostBtn: { backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  commentsList: { maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' },
  commentItem: { backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' },

  navDock: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #1e293b', zIndex: 40 },
  tab: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' },
  activeTab: { background: 'none', border: 'none', color: '#22c55e', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }
};
