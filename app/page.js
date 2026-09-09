'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtjehqjnazsxvdzqtkgh.supabase.co';
const supabaseAnonKey = 'sb_publishable_sqVY-eC8omT648v-K5hiUw_u03LW-3r';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState(null);

  // Native PWA App Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

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
  const [searchCategory, setSearchCategory] = useState('all');
  const [profileSubTab, setProfileSubTab] = useState('posts');

  // Likes & Comments Interactive State
  const [userLikes, setUserLikes] = useState([]);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Selected Post Management Modal State
  const [selectedPost, setSelectedPost] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [postLikers, setPostLikers] = useState([]);

  // Public User Profile View Modal State
  const [viewingProfile, setViewingProfile] = useState(null);
  const [userFollows, setUserFollows] = useState([]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('To install on iOS: Tap Share -> Add to Home Screen. On Chrome: Tap Menu (⋮) -> Install App.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

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
      fetchUserFollows();
    } else {
      setUserLikes([]);
      setUserFollows([]);
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
      .maybeSingle();

    if (!error && data) {
      setUsername(data.username || '');
      setBio(data.bio || '');
      setWebsite(data.website || '');
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) setProfiles(data);
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, likes(id, user_id), comments(id, content, created_at, profiles(username)), profiles(username, bio, website)')
      .order('created_at', { ascending: false });

    if (!error && data) setPosts(data);
  };

  const fetchUserLikes = async () => {
    if (!user) return;
    const { data } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
    if (data) setUserLikes(data.map(l => l.post_id));
  };

  const fetchUserFollows = async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    if (data) setUserFollows(data.map(f => f.following_id));
  };

  const handleToggleFollow = async (targetUserId) => {
    if (!user) return alert('Please log in to follow creators.');
    if (user.id === targetUserId) return alert("You cannot follow yourself.");

    const isFollowing = userFollows.includes(targetUserId);

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
      setUserFollows(prev => prev.filter(id => id !== targetUserId));
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: targetUserId }]);
      setUserFollows(prev => [...prev, targetUserId]);
    }
  };

  const handleLike = async (postId) => {
    if (!user) return alert('Please log in to like posts.');
    const isLiked = userLikes.includes(postId);

    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
      setUserLikes(prev => prev.filter(id => id !== postId));
    } else {
      await supabase.from('likes').insert([{ user_id: user.id, post_id: postId }]);
      setUserLikes(prev => [...prev, postId]);
    }
    fetchPosts();
  };

  const handleOpenComments = async (postId) => {
    setActiveCommentPostId(postId);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username)')
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

  const handleOpenPostDetails = async (post) => {
    setSelectedPost(post);
    setEditCaption(post.caption || '');

    const { data } = await supabase
      .from('likes')
      .select('user_id, profiles(username)')
      .eq('post_id', post.id);

    if (data) {
      setPostLikers(data.map(d => d.profiles?.username || 'User'));
    }
  };

  const handleUpdatePost = async () => {
    if (!selectedPost) return;
    const { error } = await supabase
      .from('posts')
      .update({ caption: editCaption })
      .eq('id', selectedPost.id);

    if (error) {
      alert(error.message);
    } else {
      alert('Post updated successfully!');
      setSelectedPost(null);
      fetchPosts();
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    if (!confirm('Are you sure you want to delete this post?')) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', selectedPost.id);

    if (error) {
      alert(error.message);
    } else {
      alert('Post deleted!');
      setSelectedPost(null);
      fetchPosts();
    }
  };

  const openUserProfileModal = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setViewingProfile(data);
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        },
      });
      if (error) throw error;
    } catch (err) {
      alert(err.message);
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
          caption: caption || '',
          post_type: postType || 'media'
        }]);

      if (insertError) throw insertError;

      alert(`${postType === 'article' ? 'Article' : 'Post'} published!`);
      setCaption('');
      setFile(null);
      setPreviewUrl(null);
      setShowCreateModal(false);
      
      await fetchPosts();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  };

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

  const filteredProfiles = profiles.filter(p => 
    p.username?.toLowerCase().includes(cleanedQuery.replace('@', '')) ||
    p.bio?.toLowerCase().includes(cleanedQuery)
  );

  const matchingHashtags = getAllHashtags().filter(item => 
    item.tag.includes(cleanedQuery.replace('#', ''))
  );

  const isVideoFile = (url) => {
    if (!url) return false;
    return Boolean(url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video'));
  };

  const filteredPosts = posts.filter(post => {
    const captionLower = (post.caption || '').toLowerCase();
    const usernameLower = (post.profiles?.username || '').toLowerCase();
    const postTags = extractHashtags(post.caption);
    const isVideo = isVideoFile(post.video_url);

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
        <button onClick={handleInstallClick} style={styles.headerInstallBtn}>
          📲 Install App
        </button>
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
                const isVideo = isVideoFile(post.video_url);

                return (
                  <div key={post.id} style={styles.feedCard}>
                    <div style={styles.feedCardHeader}>
                      <span 
                        onClick={() => openUserProfileModal(post.user_id)} 
                        style={styles.clickableUsername}
                      >
                        @{post.profiles?.username || 'user'}
                      </span>
                      {post.post_type === 'article' && (
                        <div style={styles.articleBadge}>Article</div>
                      )}
                    </div>
                    
                    {post.video_url && (
                      isVideo ? (
                        <video src={post.video_url} controls style={styles.videoPlayer} />
                      ) : (
                        <img src={post.video_url} alt="Post media" style={styles.mediaImage} />
                      )
                    )}
                    
                    {post.caption && <p style={styles.captionText}>{post.caption}</p>}

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

            {(searchCategory === 'all' || searchCategory === 'profiles') && filteredProfiles.length > 0 && searchQuery && (
              <div style={styles.searchResultsGroup}>
                <h4 style={styles.sectionHeading}>Profiles</h4>
                <div style={styles.profileResultsGrid}>
                  {filteredProfiles.map((p) => (
                    <div 
                      key={p.id} 
                      onClick={() => openUserProfileModal(p.id)}
                      style={styles.clickableProfileResultCard}
                    >
                      <div style={styles.miniAvatar}>
                        {p.username ? p.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={styles.profileCardName}>@{p.username || 'user'}</div>
                        <div style={styles.profileCardBio}>{p.bio || 'No bio'}</div>
                      </div>
                      <button style={styles.smallViewBtn}>View Profile</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(searchCategory !== 'profiles' && searchCategory !== 'hashtags') && (
              <div style={styles.searchResultsGroup}>
                <h4 style={styles.sectionHeading}>Content Stream ({filteredPosts.length})</h4>
                {filteredPosts.length === 0 ? (
                  <p style={styles.emptyText}>No results match your search query.</p>
                ) : (
                  <div style={styles.searchGrid}>
                    {filteredPosts.map((post) => {
                      const postTags = extractHashtags(post.caption);
                      const isVideo = isVideoFile(post.video_url);

                      return (
                        <div key={post.id} style={styles.searchGridCard}>
                          <div style={styles.searchCardHeader}>
                            <span 
                              onClick={() => openUserProfileModal(post.user_id)} 
                              style={styles.clickableUsername}
                            >
                              @{post.profiles?.username || 'user'}
                            </span>
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
                            <span onClick={() => handleLike(post.id)} style={{ cursor: 'pointer' }}>
                              ❤️ {post.likes ? post.likes.length : 0}
                            </span>
                            <span onClick={() => handleOpenComments(post.id)} style={{ cursor: 'pointer' }}>
                              💬 {post.comments ? post.comments.length : 0}
                            </span>
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

                <button 
                  type="button" 
                  onClick={handleGoogleSignIn} 
                  style={styles.googleBtn}
                >
                  <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div style={styles.divider}>or with email</div>

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
                        <span style={styles.statNumber}>{userFollows.length}</span>
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

                <div style={styles.mediaGrid}>
                  {userPosts
                    .filter(p => profileSubTab === 'articles' ? p.post_type === 'article' : p.post_type !== 'article')
                    .map(post => (
                      <div 
                        key={post.id} 
                        onClick={() => handleOpenPostDetails(post)} 
                        style={styles.gridItemClickable}
                      >
                        {post.video_url ? (
                          isVideoFile(post.video_url) ? (
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

      {/* FOOTER NAVIGATION BAR */}
      <nav style={styles.navBar}>
        <button 
          onClick={() => setActiveTab('home')} 
          style={activeTab === 'home' ? styles.activeNavBtn : styles.navBtn}
        >
          🏠 <span>Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('search')} 
          style={activeTab === 'search' ? styles.activeNavBtn : styles.navBtn}
        >
          🔍 <span>Search</span>
        </button>
        <button 
          onClick={() => setActiveTab('dms')} 
          style={activeTab === 'dms' ? styles.activeNavBtn : styles.navBtn}
        >
          💬 <span>DMs</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          style={activeTab === 'profile' ? styles.activeNavBtn : styles.navBtn}
        >
          👤 <span>Profile</span>
        </button>
      </nav>

      {/* PUBLIC USER PROFILE MODAL */}
      {viewingProfile && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>@{viewingProfile.username || 'user'}</h3>
              <button onClick={() => setViewingProfile(null)} style={styles.closeBtn}>✕</button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '8px 0' }}>{viewingProfile.bio || 'No bio provided.'}</p>
            {viewingProfile.website && (
              <a href={viewingProfile.website} target="_blank" rel="noreferrer" style={styles.proWebsite}>
                🔗 {viewingProfile.website}
              </a>
            )}

            {user && user.id !== viewingProfile.id && (
              <button 
                onClick={() => handleToggleFollow(viewingProfile.id)}
                style={userFollows.includes(viewingProfile.id) ? styles.secondaryBtn : styles.primaryBtn}
              >
                {userFollows.includes(viewingProfile.id) ? 'Following ✓' : 'Follow +'}
              </button>
            )}

            <h4 style={{ ...styles.sectionHeading, marginTop: '16px' }}>Posts by @{viewingProfile.username}</h4>
            <div style={styles.mediaGrid}>
              {posts
                .filter(p => p.user_id === viewingProfile.id)
                .map(post => (
                  <div key={post.id} style={styles.gridItem}>
                    {post.video_url ? (
                      isVideoFile(post.video_url) ? (
                        <video src={post.video_url} style={styles.gridMedia} />
                      ) : (
                        <img src={post.video_url} alt="Media" style={styles.gridMedia} />
                      )
                    ) : (
                      <div style={styles.textTile}>{post.caption}</div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MANAGE MY POST MODAL */}
      {selectedPost && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Manage Post</h3>
              <button onClick={() => setSelectedPost(null)} style={styles.closeBtn}>✕</button>
            </div>

            {selectedPost.video_url && (
              isVideoFile(selectedPost.video_url) ? (
                <video src={selectedPost.video_url} controls style={{ width: '100%', borderRadius: '8px', margin: '10px 0' }} />
              ) : (
                <img src={selectedPost.video_url} alt="Post media" style={{ width: '100%', borderRadius: '8px', margin: '10px 0' }} />
              )
            )}

            <label style={styles.sectionHeading}>Edit Caption / Content:</label>
            <textarea 
              value={editCaption} 
              onChange={(e) => setEditCaption(e.target.value)} 
              style={{ ...styles.input, height: '80px', margin: '6px 0 12px 0' }} 
            />

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={handleUpdatePost} style={styles.primaryBtn}>Save Caption</button>
              <button onClick={handleDeletePost} style={styles.dangerBtn}>Delete Post 🗑️</button>
            </div>

            <h4 style={styles.sectionHeading}>Reactions ({postLikers.length})</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {postLikers.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>No likes yet</span>
              ) : (
                postLikers.map((username, idx) => (
                  <span key={idx} style={styles.likerBadge}>❤️ @{username}</span>
                ))
              )}
            </div>

            <h4 style={styles.sectionHeading}>Comments ({selectedPost.comments?.length || 0})</h4>
            <div style={styles.commentsList}>
              {(!selectedPost.comments || selectedPost.comments.length === 0) ? (
                <p style={{ color: '#94a3b8', fontSize: '12px' }}>No comments yet.</p>
              ) : (
                selectedPost.comments.map(c => (
                  <div key={c.id} style={styles.commentItem}>
                    <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '12px' }}>
                      @{c.profiles?.username || 'user'}:
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px' }}>{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
                    <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '12px' }}>
                      @{c.profiles?.username || 'user'}
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px' }}>{c.content}</p>
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
              <button onClick={() => { setShowCreateModal(false); setPreviewUrl(null); }} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', margin: '10px 0' }}>
              <button 
                type="button"
                onClick={() => setPostType('media')} 
                style={postType === 'media' ? styles.primaryBtn : styles.secondaryBtn}
              >
                Media Post
              </button>
              <button 
                type="button"
                onClick={() => setPostType('article')} 
                style={postType === 'article' ? styles.primaryBtn : styles.secondaryBtn}
              >
                Article
              </button>
            </div>

            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                type="file" 
                accept="image/*,video/*" 
                onChange={handleFileChange} 
                style={styles.input}
              />

              {previewUrl && (
                <div style={{ margin: '5px 0' }}>
                  {file?.type.startsWith('video/') ? (
                    <video src={previewUrl} controls style={{ width: '100%', borderRadius: '8px' }} />
                  ) : (
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', borderRadius: '8px' }} />
                  )}
                </div>
              )}

              <textarea 
                placeholder="Write a caption or article content..." 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                style={{ ...styles.input, height: '90px' }} 
              />

              <button type="submit" disabled={uploading} style={styles.primaryBtn}>
                {uploading ? 'Publishing...' : 'Publish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'sans-serif',
    paddingBottom: '70px',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '800',
    letterSpacing: '2px',
    color: '#38bdf8',
  },
  headerInstallBtn: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  mainContent: {
    padding: '16px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  roomContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  roomTitle: {
    fontSize: '18px',
    margin: '0 0 8px 0',
  },
  feedCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  feedCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clickableUsername: {
    fontWeight: 'bold',
    color: '#38bdf8',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  articleBadge: {
    backgroundColor: '#0369a1',
    color: '#fff',
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  videoPlayer: {
    width: '100%',
    borderRadius: '8px',
  },
  mediaImage: {
    width: '100%',
    borderRadius: '8px',
  },
  captionText: {
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.4',
  },
  interactionRow: {
    display: 'flex',
    gap: '12px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
  },
  navBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '10px 0',
    zIndex: 10,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  activeNavBtn: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  emptyText: {
    color: '#64748b',
    fontSize: '14px',
  },
  authContainer: {
    backgroundColor: '#1e293b',
    padding: '20px',
    borderRadius: '12px',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#fff',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  passwordInput: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#fff',
    padding: '10px',
    paddingRight: '40px',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  primaryBtn: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    flex: 1,
  },
  secondaryBtn: {
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    flex: 1,
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    color: '#000',
    border: 'none',
    padding: '10px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
  },
  divider: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '12px',
    margin: '12px 0',
  },
  searchHeaderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  searchInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
  },
  searchInput: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fff',
    padding: '10px 35px',
    borderRadius: '20px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  matrixCategoryRow: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  matrixChip: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  activeMatrixChip: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  hashtagSection: {
    backgroundColor: '#1e293b',
    padding: '12px',
    borderRadius: '8px',
  },
  sectionHeading: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    color: '#94a3b8',
  },
  hashtagCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  hashtagPill: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    gap: '6px',
  },
  hashtagBadge: {
    backgroundColor: '#334155',
    color: '#fff',
    padding: '0 4px',
    borderRadius: '8px',
    fontSize: '10px',
  },
  searchResultsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  profileResultsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  clickableProfileResultCard: {
    backgroundColor: '#1e293b',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  smallViewBtn: {
    backgroundColor: '#334155',
    color: '#38bdf8',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  miniAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#0284c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  profileCardName: {
    fontWeight: 'bold',
    fontSize: '14px',
  },
  profileCardBio: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  searchGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  searchGridCard: {
    backgroundColor: '#1e293b',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  searchCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
  },
  typeBadgeVideo: { color: '#ef4444' },
  typeBadgeArticle: { color: '#eab308' },
  typeBadgeMedia: { color: '#22c55e' },
  searchGridMedia: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  searchGridCaption: {
    fontSize: '11px',
    margin: 0,
    lineHeight: '1.2',
  },
  searchGridTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px',
  },
  gridTagItem: {
    fontSize: '9px',
    color: '#22c55e',
    cursor: 'pointer',
  },
  searchGridFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#94a3b8',
  },
  chatBox: {
    backgroundColor: '#1e293b',
    padding: '20px',
    borderRadius: '8px',
    color: '#94a3b8',
  },
  proProfileCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
  },
  proHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  avatarCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#0284c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
  },
  proStatsRow: {
    display: 'flex',
    flex: 1,
    justifyContent: 'space-around',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    fontSize: '16px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  proBioSection: {
    marginTop: '12px',
  },
  proUsername: {
    margin: 0,
    fontSize: '16px',
  },
  proBioText: {
    fontSize: '13px',
    margin: '4px 0',
    color: '#cbd5e1',
  },
  proWebsite: {
    fontSize: '12px',
    color: '#38bdf8',
    textDecoration: 'none',
  },
  editProfileBtn: {
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    width: '100%',
  },
  profileBox: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subTabRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
    borderBottom: '1px solid #1e293b',
  },
  subTab: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    padding: '8px 12px',
    cursor: 'pointer',
  },
  activeSubTab: {
    background: 'none',
    borderBottom: '2px solid #0284c7',
    color: '#38bdf8',
    padding: '8px 12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '4px',
    marginTop: '12px',
  },
  gridItemClickable: {
    aspectRatio: '1',
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #334155',
  },
  gridItem: {
    aspectRatio: '1',
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  gridMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  textTile: {
    padding: '4px',
    fontSize: '10px',
    overflow: 'hidden',
  },
  bottomLeftMenuWrapper: {
    position: 'fixed',
    bottom: '80px',
    left: '16px',
  },
  threeDotBtn: {
    backgroundColor: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
  },
  settingsDropdown: {
    position: 'absolute',
    bottom: '45px',
    left: 0,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '4px',
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  likerBadge: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    color: '#38bdf8',
  },
  createPostContainer: {
    position: 'fixed',
    bottom: '80px',
    right: '16px',
  },
  createPostBtn: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: '16px',
  },
  modalCard: {
    backgroundColor: '#1e293b',
    padding: '20px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: '12px 0',
  },
  commentItem: {
    backgroundColor: '#0f172a',
    padding: '8px',
    borderRadius: '6px',
  },
};
