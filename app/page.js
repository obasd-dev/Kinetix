'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtjehqjnazsxvdzqtkgh.supabase.co';
const supabaseAnonKey = 'sb_publishable_sqVY-eC8omT648v-K5hiUw_u03LW-3r';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFeed, setSelectedFeed] = useState('for-you');
  const [user, setUser] = useState(null);

  // Native PWA App Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authMessageType, setAuthMessageType] = useState('info');

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

  // Interactive & Modal State
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
  const [viewingProfileTab, setViewingProfileTab] = useState('posts');
  const [userFollows, setUserFollows] = useState([]);
  const [userFollowers, setUserFollowers] = useState([]);
  const [modalUserList, setModalUserList] = useState({ title: '', users: [] });

  // Direct Messaging State
  const [activeConversation, setActiveConversation] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInputText, setDmInputText] = useState('');
  const [sendingDm, setSendingDm] = useState(false);

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
    let mounted = true;

    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session Fetch Error:', error);
        return;
      }
      if (mounted) {
        setUser(session?.user || null);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUser(session?.user || null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchProfiles();

    if (user) {
      fetchUserLikes();
      fetchUserProfile();
      fetchUserFollows();
      fetchUserFollowers();
    } else {
      setUserLikes([]);
      setUserFollows([]);
      setUserFollowers([]);
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

    if (error) console.error("Profile Fetch Error:", error);
    if (!error && data) {
      setUsername(data.username || '');
      setBio(data.bio || '');
      setWebsite(data.website || '');
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) console.error("Profiles Fetch Error:", error);
    if (!error && data) setProfiles(data);
  };

  const fetchPosts = async () => {
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postError) {
        console.error('Posts Fetch Error:', postError);
        return;
      }

      const safePosts = postData || [];
      if (safePosts.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = safePosts.map(post => post.id);
      const userIds = [...new Set(safePosts.map(post => post.user_id).filter(Boolean))];

      const [
        { data: profileData },
        { data: likeData },
        { data: commentData }
      ] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id, username, bio, website').in('id', userIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from('likes').select('id, user_id, post_id').in('post_id', postIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from('comments').select('id, user_id, post_id, content, created_at').in('post_id', postIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] })
      ]);

      const profilesById = Object.fromEntries(
        (profileData || []).map(profile => [profile.id, profile])
      );

      const likesByPost = {};
      (likeData || []).forEach(like => {
        if (!likesByPost[like.post_id]) likesByPost[like.post_id] = [];
        likesByPost[like.post_id].push(like);
      });

      const commentsByPost = {};
      (commentData || []).forEach(comment => {
        if (!commentsByPost[comment.post_id]) commentsByPost[comment.post_id] = [];
        commentsByPost[comment.post_id].push({
          ...comment,
          profiles: profilesById[comment.user_id] || null
        });
      });

      const hydratedPosts = safePosts.map(post => ({
        ...post,
        profiles: profilesById[post.user_id] || null,
        likes: likesByPost[post.id] || [],
        comments: commentsByPost[post.id] || []
      }));

      setPosts(hydratedPosts);
    } catch (error) {
      console.error('Unexpected Posts Fetch Error:', error);
    }
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

  const fetchUserFollowers = async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
    if (data) setUserFollowers(data.map(f => f.follower_id));
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
    fetchUserFollowers();
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

  const handleResharePost = async (originalPost) => {
    if (!user) return alert('Please log in to reshare.');
    
    const { error } = await supabase.from('posts').insert([{
      user_id: user.id,
      caption: `🔄 Reshared: ${originalPost.caption || ''}`,
      video_url: originalPost.video_url,
      post_type: originalPost.post_type,
      repost_of: originalPost.id
    }]);

    if (error) {
      alert(`Reshare failed: ${error.message}`);
    } else {
      alert('Post reshared to your profile stream!');
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
      .eq('id', selectedPost.id)
      .eq('user_id', user.id);

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
      .eq('id', selectedPost.id)
      .eq('user_id', user.id);

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

  const showUserListModal = (title, userIds) => {
    const matchedProfiles = profiles.filter(p => userIds.includes(p.id));
    setModalUserList({ title, users: matchedProfiles });
  };

  // Direct Messaging Real-time Handling
  const startConversationWithUser = async (targetUserId) => {
    if (!user) return alert('Please sign in to send messages.');
    
    // Validate follow requirements before opening direct communication
    const targetIsFollowed = userFollows.includes(targetUserId);
    if (!targetIsFollowed) {
      return alert('You must follow this user before starting a private conversation.');
    }

    try {
      const { data: mine } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const mineIds = (mine || []).map(r => r.conversation_id);
      let convId = null;

      if (mineIds.length) {
        const { data: theirs } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', mineIds);

        if (theirs?.length) convId = theirs[0].conversation_id;
      }

      if (!convId) {
        const { data: newConv, error: cErr } = await supabase
          .from('conversations')
          .insert({})
          .select()
          .single();
        if (cErr) throw cErr;

        convId = newConv.id;
        await supabase.from('conversation_members').insert([
          { conversation_id: convId, user_id: user.id },
          { conversation_id: convId, user_id: targetUserId }
        ]);
      }

      setActiveConversation({ id: convId, targetUserId });
      setActiveTab('dms');
      loadDmMessages(convId);
    } catch (err) {
      alert(`Unable to initialize chat: ${err.message}`);
    }
  };

  const loadDmMessages = async (conversationId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) setDmMessages(data);
  };

  const handleSendDm = async (e) => {
    e.preventDefault();
    if (!dmInputText.trim() || !activeConversation || !user) return;

    setSendingDm(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      message_type: 'text',
      content: dmInputText.trim()
    });

    setSendingDm(false);
    if (!error) {
      setDmInputText('');
      loadDmMessages(activeConversation.id);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthMessage('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setAuthMessage(err?.message || 'Google sign-in could not be started.');
      setAuthMessageType('error');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setAuthMessage('Please enter your email and password.');
      setAuthMessageType('error');
      return;
    }

    if (password.length < 6) {
      setAuthMessage('Password must be at least 6 characters.');
      setAuthMessageType('error');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthMessageType('error');
      return;
    }

    if (data?.session) {
      setAuthMessage('Account created successfully.');
      setAuthMessageType('success');
      return;
    }

    setAuthMessage(`Account created for ${normalizedEmail}. Check your inbox for confirmation.`);
    setAuthMessageType('success');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setAuthMessage('Please enter your email and password.');
      setAuthMessageType('error');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) {
      setAuthMessage(error.message || 'Unable to sign in.');
      setAuthMessageType('error');
    } else {
      setAuthMessage('');
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

    if (error) {
      alert(error.message);
    } else {
      await fetchUserProfile();
      await fetchProfiles();
      await fetchPosts();
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
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
    if (!user?.id) return alert('You must be logged in.');

    const trimmedCaption = caption.trim();
    if (postType === 'article' && !trimmedCaption && !file) {
      return alert('Please write your article content or attach a file.');
    }
    if (postType !== 'article' && !file && !trimmedCaption) {
      return alert('Please add a photo, video, or caption.');
    }

    try {
      setUploading(true);
      let mediaUrl = null;
      let uploadedPath = null;

      if (file) {
        const fileExt = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
        const fileName = `${user.id}/${Date.now()}-${safeName || `upload.${fileExt}`}`;
        uploadedPath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

        if (uploadError) throw new Error(`Media upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(fileName);
        mediaUrl = publicUrlData?.publicUrl || null;
      }

      const { data: createdPost, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          video_url: mediaUrl,
          caption: trimmedCaption,
          post_type: postType || 'media'
        })
        .select('*')
        .single();

      if (insertError) {
        if (uploadedPath) await supabase.storage.from('videos').remove([uploadedPath]);
        throw new Error(`Post could not be saved: ${insertError.message}`);
      }

      setCaption('');
      setFile(null);
      setPreviewUrl(null);
      setShowCreateModal(false);
      alert('Published successfully!');
      await fetchPosts();
    } catch (err) {
      alert(err?.message || 'Something went wrong while publishing.');
    } finally {
      setUploading(false);
    }
  };

  const extractHashtags = (text) => {
    if (!text) return [];
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  };

  const isVideoFile = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
      return /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(pathname);
    } catch {
      return /\.(mp4|webm|ogg|mov|m4v|avi)(?:$|[?#])/i.test(url.toLowerCase());
    }
  };

  const renderPostMedia = (post, className) => {
    if (!post?.video_url) return null;
    if (isVideoFile(post.video_url)) {
      return <video src={post.video_url} controls playsInline preload="metadata" style={className} />;
    }
    return <img src={post.video_url} alt="Post media" loading="lazy" style={className} />;
  };

  // Filter feed according to category tab selections
  const displayPosts = posts.filter(post => {
    if (selectedFeed === 'following') return userFollows.includes(post.user_id);
    if (selectedFeed === 'articles') return post.post_type === 'article';
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
        {/* HOME TAB WITH STREAM CONTROLS */}
        {activeTab === 'home' && (
          <section style={styles.roomContainer}>
            <div style={styles.feedSelectorRow}>
              {['for-you', 'following', 'articles'].map((feedKey) => (
                <button
                  key={feedKey}
                  onClick={() => setSelectedFeed(feedKey)}
                  style={selectedFeed === feedKey ? styles.activeFeedChip : styles.feedChip}
                >
                  {feedKey.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>

            {displayPosts.length === 0 ? (
              <p style={styles.emptyText}>No posts found in this stream tab.</p>
            ) : (
              displayPosts.map((post) => {
                const isLiked = userLikes.includes(post.id);
                return (
                  <div key={post.id} style={styles.feedCard}>
                    <div style={styles.feedCardHeader}>
                      <span onClick={() => openUserProfileModal(post.user_id)} style={styles.clickableUsername}>
                        @{post.profiles?.username || 'user'}
                      </span>
                      {post.post_type === 'article' && <div style={styles.articleBadge}>Article</div>}
                    </div>

                    {renderPostMedia(post, isVideoFile(post.video_url) ? styles.videoPlayer : styles.mediaImage)}
                    {post.caption && <p style={styles.captionText}>{post.caption}</p>}

                    <div style={styles.interactionRow}>
                      <button onClick={() => handleLike(post.id)} style={{ ...styles.actionBtn, color: isLiked ? '#ef4444' : '#94a3b8' }}>
                        {isLiked ? '❤️' : '🤍'} {post.likes?.length || 0}
                      </button>
                      <button onClick={() => handleOpenComments(post.id)} style={styles.actionBtn}>
                        💬 {post.comments?.length || 0}
                      </button>
                      <button onClick={() => handleResharePost(post)} style={styles.actionBtn}>
                        🔄 Reshare
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* SEARCH & DISCOVERY TAB */}
        {activeTab === 'search' && (
          <section style={styles.roomContainer}>
            <div style={styles.searchHeaderGroup}>
              <h2 style={styles.roomTitle}>Discovery Engine</h2>
              <input 
                type="text" 
                placeholder="Search @usernames, #hashtags, posts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            {/* Search list results rendering */}
            <div style={styles.searchResultsGroup}>
              {profiles
                .filter(p => p.username?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(p => (
                  <div key={p.id} onClick={() => openUserProfileModal(p.id)} style={styles.clickableProfileResultCard}>
                    <div style={styles.miniAvatar}>{p.username?.charAt(0).toUpperCase() || 'U'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.profileCardName}>@{p.username || 'user'}</div>
                      <div style={styles.profileCardBio}>{p.bio || 'No bio'}</div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* MESSAGES / DIRECT CHAT TAB */}
        {activeTab === 'dms' && (
          <section style={styles.roomContainer}>
            <h2 style={styles.roomTitle}>Direct Conversations</h2>
            {!user ? (
              <p style={styles.emptyText}>Please sign in to view your conversations.</p>
            ) : !activeConversation ? (
              <div style={styles.chatBox}>
                <p>Select a user from their profile to start messaging. (Requires following)</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.chatHeader}>
                  <span>Active Conversation</span>
                  <button onClick={() => setActiveConversation(null)} style={styles.smallViewBtn}>Close</button>
                </div>
                <div style={styles.dmHistoryWindow}>
                  {dmMessages.map(msg => (
                    <div key={msg.id} style={msg.sender_id === user.id ? styles.dmOwnMsg : styles.dmOtherMsg}>
                      {msg.content}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendDm} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dmInputText}
                    onChange={(e) => setDmInputText(e.target.value)}
                    placeholder="Write a message..."
                    style={styles.input}
                  />
                  <button type="submit" disabled={sendingDm} style={styles.primaryBtn}>Send</button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* PROFILE TAB WITH REAL USER INTERACTION */}
        {activeTab === 'profile' && (
          <section style={styles.roomContainer}>
            {!user ? (
              <div style={styles.authContainer}>
                <h2 style={styles.roomTitle}>Sign In / Sign Up</h2>
                <button type="button" onClick={handleGoogleSignIn} style={styles.googleBtn}>
                  Continue with Google
                </button>
                <div style={styles.divider}>or with email</div>
                {authMessage && (
                  <div style={{ ...styles.authMessage, ...(authMessageType === 'error' ? styles.authMessageError : styles.authMessageSuccess) }}>
                    {authMessage}
                  </div>
                )}
                <form style={styles.authForm}>
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
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
                    <div style={styles.avatarCircle}>{username ? username.charAt(0).toUpperCase() : 'U'}</div>
                    <div style={styles.proStatsRow}>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>{userPosts.length}</span>
                        <span style={styles.statLabel}>Posts</span>
                      </div>
                      <div style={{ ...styles.statBox, cursor: 'pointer' }} onClick={() => showUserListModal('Followers', userFollowers)}>
                        <span style={styles.statNumber}>{userFollowers.length}</span>
                        <span style={styles.statLabel}>Followers</span>
                      </div>
                      <div style={{ ...styles.statBox, cursor: 'pointer' }} onClick={() => showUserListModal('Following', userFollows)}>
                        <span style={styles.statNumber}>{userFollows.length}</span>
                        <span style={styles.statLabel}>Following</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.proBioSection}>
                    <h3 style={styles.proUsername}>@{username || 'username'}</h3>
                    <p style={styles.proBioText}>{bio || 'No bio added yet.'}</p>
                  </div>

                  <button onClick={() => setIsEditingProfile(!isEditingProfile)} style={styles.editProfileBtn}>
                    {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
                  </button>

                  {isEditingProfile && (
                    <form onSubmit={handleSaveProfile} style={styles.profileBox}>
                      <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
                      <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} style={{ ...styles.input, height: '60px' }} />
                      <button type="submit" style={styles.primaryBtn}>Save Profile</button>
                    </form>
                  )}
                </div>

                {/* Sub-tab selection grid */}
                <div style={styles.subTabRow}>
                  <button onClick={() => setProfileSubTab('posts')} style={profileSubTab === 'posts' ? styles.activeSubTab : styles.subTab}>
                    Posts
                  </button>
                  <button onClick={() => setProfileSubTab('articles')} style={profileSubTab === 'articles' ? styles.activeSubTab : styles.subTab}>
                    Articles
                  </button>
                </div>

                <div style={styles.mediaGrid}>
                  {userPosts
                    .filter(p => profileSubTab === 'articles' ? p.post_type === 'article' : p.post_type !== 'article')
                    .map(post => (
                      <div key={post.id} onClick={() => handleOpenPostDetails(post)} style={styles.gridItemClickable}>
                        {post.video_url ? renderPostMedia(post, styles.gridMedia) : <div style={styles.textTile}>{post.caption}</div>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {user && (
              <div style={styles.createPostContainer}>
                <button onClick={() => setShowCreateModal(true)} style={styles.createPostBtn}>➕ Create Post</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* FOOTER NAVIGATION */}
      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('home')} style={activeTab === 'home' ? styles.activeNavBtn : styles.navBtn}>
          🏠 <span>Home</span>
        </button>
        <button onClick={() => setActiveTab('search')} style={activeTab === 'search' ? styles.activeNavBtn : styles.navBtn}>
          🔍 <span>Search</span>
        </button>
        <button onClick={() => setActiveTab('dms')} style={activeTab === 'dms' ? styles.activeNavBtn : styles.navBtn}>
          💬 <span>DMs</span>
        </button>
        <button onClick={() => setActiveTab('profile')} style={activeTab === 'profile' ? styles.activeNavBtn : styles.navBtn}>
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
            <p style={{ color: '#cbd5e1', fontSize: '13px' }}>{viewingProfile.bio || 'No bio provided.'}</p>

            <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
              {user && user.id !== viewingProfile.id && (
                <>
                  <button onClick={() => handleToggleFollow(viewingProfile.id)} style={userFollows.includes(viewingProfile.id) ? styles.secondaryBtn : styles.primaryBtn}>
                    {userFollows.includes(viewingProfile.id) ? 'Following ✓' : 'Follow +'}
                  </button>
                  <button onClick={() => { setViewingProfile(null); startConversationWithUser(viewingProfile.id); }} style={styles.primaryBtn}>
                    💬 Direct Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* USER LIST MODAL (FOLLOWERS / FOLLOWING) */}
      {modalUserList.users.length > 0 && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{modalUserList.title}</h3>
              <button onClick={() => setModalUserList({ title: '', users: [] })} style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {modalUserList.users.map(u => (
                <div key={u.id} onClick={() => { setModalUserList({ title: '', users: [] }); openUserProfileModal(u.id); }} style={styles.clickableProfileResultCard}>
                  <span style={styles.clickableUsername}>@{u.username || 'user'}</span>
                </div>
              ))}
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
              {comments.map(c => (
                <div key={c.id} style={styles.commentItem}>
                  <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '12px' }}>@{c.profiles?.username || 'user'}: </span>
                  <span style={{ fontSize: '13px' }}>{c.content}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Write comment..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} style={styles.input} />
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
            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={styles.input} />
              <textarea placeholder="Write caption..." value={caption} onChange={(e) => setCaption(e.target.value)} style={{ ...styles.input, height: '80px' }} />
              <button type="submit" disabled={uploading} style={styles.primaryBtn}>{uploading ? 'Publishing...' : 'Publish'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif', paddingBottom: '70px' },
  header: { padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', position: 'sticky', top: 0, zIndex: 10 },
  logo: { margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '2px', color: '#38bdf8' },
  headerInstallBtn: { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  mainContent: { padding: '16px', maxWidth: '600px', margin: '0 auto' },
  roomContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  roomTitle: { fontSize: '18px', margin: '0 0 8px 0' },
  feedSelectorRow: { display: 'flex', gap: '8px', marginBottom: '8px' },
  feedChip: { backgroundColor: '#1e293b', color: '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer' },
  activeFeedChip: { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  feedCard: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  feedCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  clickableUsername: { fontWeight: 'bold', color: '#38bdf8', cursor: 'pointer' },
  articleBadge: { backgroundColor: '#0369a1', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '12px' },
  videoPlayer: { width: '100%', borderRadius: '8px', backgroundColor: '#000' },
  mediaImage: { width: '100%', height: 'auto', borderRadius: '8px', objectFit: 'contain' },
  captionText: { margin: 0, fontSize: '14px', lineHeight: '1.4' },
  interactionRow: { display: 'flex', gap: '12px' },
  actionBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: 0 },
  navBar: { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-around', padding: '10px 0', zIndex: 10 },
  navBtn: { background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' },
  activeNavBtn: { background: 'none', border: 'none', color: '#38bdf8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' },
  emptyText: { color: '#64748b', fontSize: '14px' },
  authContainer: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '12px' },
  authMessage: { padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px' },
  authMessageError: { backgroundColor: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca' },
  authMessageSuccess: { backgroundColor: '#052e16', border: '1px solid #166534', color: '#bbf7d0' },
  input: { backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  primaryBtn: { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  secondaryBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', flex: 1 },
  googleBtn: { backgroundColor: '#ffffff', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  divider: { textAlign: 'center', color: '#64748b', fontSize: '12px', margin: '12px 0' },
  searchHeaderGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  searchInput: { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '20px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  searchResultsGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  clickableProfileResultCard: { backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  smallViewBtn: { backgroundColor: '#334155', color: '#38bdf8', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' },
  miniAvatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  profileCardName: { fontWeight: 'bold', fontSize: '14px' },
  profileCardBio: { color: '#94a3b8', fontSize: '12px' },
  chatBox: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', color: '#94a3b8' },
  chatHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #334155' },
  dmHistoryWindow: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '8px', backgroundColor: '#0f172a', borderRadius: '8px' },
  dmOwnMsg: { alignSelf: 'flex-end', backgroundColor: '#0284c7', color: '#fff', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', fontSize: '13px' },
  dmOtherMsg: { alignSelf: 'flex-start', backgroundColor: '#334155', color: '#fff', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', fontSize: '13px' },
  proProfileCard: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '16px' },
  proHeader: { display: 'flex', alignItems: 'center', gap: '16px' },
  avatarCircle: { width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' },
  proStatsRow: { display: 'flex', flex: 1, justifyContent: 'space-around' },
  statBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statNumber: { fontWeight: 'bold', fontSize: '16px' },
  statLabel: { fontSize: '11px', color: '#94a3b8' },
  proBioSection: { marginTop: '12px' },
  proUsername: { margin: 0, fontSize: '16px' },
  proBioText: { fontSize: '13px', margin: '4px 0', color: '#cbd5e1' },
  editProfileBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', width: '100%', marginTop: '10px' },
  profileBox: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  subTabRow: { display: 'flex', gap: '10px', marginTop: '16px', borderBottom: '1px solid #1e293b' },
  subTab: { background: 'none', border: 'none', color: '#64748b', padding: '8px 12px', cursor: 'pointer' },
  activeSubTab: { background: 'none', borderBottom: '2px solid #0284c7', color: '#38bdf8', padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer' },
  mediaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '12px' },
  gridItemClickable: { aspectRatio: '1', backgroundColor: '#1e293b', overflow: 'hidden', borderRadius: '4px', cursor: 'pointer', border: '1px solid #334155' },
  gridMedia: { width: '100%', height: '100%', objectFit: 'cover' },
  textTile: { padding: '4px', fontSize: '10px', overflow: 'hidden' },
  createPostContainer: { position: 'fixed', bottom: '80px', right: '16px' },
  createPostBtn: { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: '16px' },
  modalCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
  commentsList: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' },
  commentItem: { backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px' }
};
