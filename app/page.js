'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kmqkqdzzmyzkoltxnnqt.supabase.co';
const supabaseAnonKey = 'sb_publishable_tHE9rIwNAsYile9BPJwCBA_pMGRyI5S';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [feedFilter, setFeedFilter] = useState('for you');
  const [user, setUser] = useState(null);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authMessageType, setAuthMessageType] = useState('info');

  // Posts & Feed State
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [composerType, setComposerType] = useState('update');
  const [uploading, setUploading] = useState(false);

  // Broadcast Editing State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editText, setEditText] = useState('');

  // Comments State
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInput, setCommentInput] = useState('');

  // File Attachment & Preview State
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);

  // Profile State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [cropPreview, setCropPreview] = useState(null);
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [reputation, setReputation] = useState(0);
  const [userLikes, setUserLikes] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Broadcaster Profile Modal
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isFollowingSelected, setIsFollowingSelected] = useState(false);

  // Canvas Ref for Photo Cropping
  const canvasRef = useRef(null);

  // Discover Page State
  const [discoverSearch, setDiscoverSearch] = useState('');

  // Create Page State (Communities)
  const [communityName, setCommunityName] = useState('');
  const [communityDesc, setCommunityDesc] = useState('');
  const [communityTag, setCommunityTag] = useState('Tech');
  const [communities, setCommunities] = useState([
    { id: 1, name: 'Cyber Builders', desc: 'A hub for indie hackers & full-stack devs.', members: 1240, tag: 'Tech' },
    { id: 2, name: 'AI & Neural Labs', desc: 'Discussing the future of generative models & LLMs.', members: 3100, tag: 'AI' },
    { id: 3, name: 'Design Systems Hub', desc: 'UI/UX designers sharing Figma, CSS, and aesthetic web art.', members: 890, tag: 'Design' }
  ]);

  // Messages & Activity State
  const [msgSubTab, setMsgSubTab] = useState('activity');
  const [activities, setActivities] = useState([]);
  const [conversations] = useState([
    { id: '1', user: 'alex_dev', lastMsg: 'Hey, checked your latest project!', unread: true },
    { id: '2', user: 'sara_code', lastMsg: 'Let us collaborate on Next.js', unread: false }
  ]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    let mounted = true;
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setUser(session?.user || null);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUserData = async () => {
      const tasks = [fetchPosts()];

      if (user?.id) {
        tasks.push(
          fetchUserProfile(),
          fetchUserLikes(),
          fetchFollowCounts(),
          fetchActivities(),
        );
      }

      const results = await Promise.allSettled(tasks);

      if (cancelled) return;

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`BMAX initial load ${index} failed:`, result.reason);
        }
      });

      if (!user?.id) {
        setUserLikes([]);
        setActivities([]);
        setReputation(0);
        setFollowersCount(0);
        setFollowingCount(0);
      }
    };

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';

    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSeconds < 60) return 'Just now';

    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const formatReputationActivity = (log) => {
    const points = Number(log.points) || 0;
    const sign = points >= 0 ? '+' : '';

    const labels = {
      broadcast_published: 'Broadcast published',
      post_received_like: 'Your broadcast received a like',
      community_engagement: 'Community engagement',
    };

    return `${labels[log.action_type] || log.action_type} (${sign}${points} Rep)`;
  };

  const fetchUserProfile = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, bio, reputation, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('BMAX profile load error:', error);
      return;
    }

    if (!data) {
      const fallbackUsername = (user.email || 'builder').split('@')[0];

      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: fallbackUsername,
          reputation: 0,
        }, {
          onConflict: 'id',
        })
        .select('id, username, bio, reputation, avatar_url')
        .single();

      if (createProfileError) {
        console.error('BMAX profile creation error:', createProfileError);
        return;
      }

      setUsername(createdProfile?.username || fallbackUsername);
      setBio(createdProfile?.bio || '');
      setReputation(Number(createdProfile?.reputation) || 0);
      setAvatarUrl(createdProfile?.avatar_url || '');
      return;
    }

    setUsername(data.username || '');
    setBio(data.bio || '');
    setReputation(Number(data.reputation) || 0);
    setAvatarUrl(data.avatar_url || '');
  };

  const fetchFollowCounts = async () => {
    if (!user?.id) return;

    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id),
    ]);

    setFollowersCount(followersResult.count || 0);
    setFollowingCount(followingResult.count || 0);
  };

  const fetchPosts = async () => {
    const { data: postRows, error: postsError } = await supabase
      .from('posts')
      .select('id, user_id, caption, post_type, media_url, media_type, created_at')
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('BMAX posts load error:', postsError);
      return;
    }

    const rows = postRows || [];
    const userIds = [...new Set(rows.map(post => post.user_id).filter(Boolean))];

    let profileMap = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, reputation')
        .in('id', userIds);

      profileMap = Object.fromEntries(
        (profilesData || []).map(profile => [profile.id, profile])
      );
    }

    setPosts(
      rows.map(post => ({
        ...post,
        profiles: profileMap[post.user_id] || null,
      }))
    );
  };

  const fetchComments = async (postId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, post_id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch comments:', error);
      return;
    }

    const userIds = [...new Set((data || []).map(c => c.user_id))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      profileMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]));
    }

    const enrichedComments = (data || []).map(c => ({
      ...c,
      profile: profileMap[c.user_id] || null
    }));

    setCommentsMap(prev => ({ ...prev, [postId]: enrichedComments }));
  };

  const handleAddComment = async (postId) => {
    if (!user?.id) {
      alert('Please log in to comment.');
      return;
    }
    if (!commentInput.trim()) return;

    const { error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: commentInput.trim()
      });

    if (error) {
      alert('Failed to submit comment: ' + error.message);
      return;
    }

    setCommentInput('');
    fetchComments(postId);
  };

  const fetchUserLikes = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id);

    setUserLikes((data || []).map(row => row.post_id));
  };

  const fetchActivities = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('reputation_logs')
      .select('id, points, action_type, reference_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setActivities((data || []).map(log => ({
      id: log.id,
      type: 'rep',
      text: formatReputationActivity(log),
      time: formatRelativeTime(log.created_at),
    })));
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 60) {
          alert('Video duration exceeds limit! Only videos of 1 minute (60 seconds) or less can be published.');
          return;
        }
        clearMediaPreview();
        setMediaFile(file);
        setMediaType('video');
        setMediaPreview(URL.createObjectURL(file));
      };
      video.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('image/')) {
      clearMediaPreview();
      setMediaFile(file);
      setMediaType('image');
      setMediaPreview(URL.createObjectURL(file));
    } else {
      alert('Please select a valid image or video file.');
    }
  };

  const clearMediaPreview = () => {
    if (mediaPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }

    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 500, 500);

        canvas.toBlob((blob) => {
          setCroppedBlob(blob);
          setCropPreview(canvas.toDataURL('image/jpeg'));
        }, 'image/jpeg', 0.9);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    const cleanUsername = username.trim();
    const cleanBio = bio.trim();
    let finalAvatarUrl = avatarUrl;

    try {
      if (croppedBlob) {
        const fileName = `${user.id}-${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          throw new Error(`Avatar upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        finalAvatarUrl = urlData?.publicUrl || finalAvatarUrl;
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: cleanUsername,
          bio: cleanBio,
          avatar_url: finalAvatarUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })
        .select('id, username, bio, reputation, avatar_url')
        .single();

      if (error) {
        throw new Error(`Error updating profile: ${error.message}`);
      }

      setUsername(data?.username || '');
      setBio(data?.bio || '');
      setReputation(Number(data?.reputation) || 0);
      setAvatarUrl(data?.avatar_url || '');
      setAvatarFile(null);
      setCropPreview(null);
      setCroppedBlob(null);
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('BMAX profile update error:', err);
      alert(err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      alert('Please sign in to publish a broadcast.');
      return;
    }

    if (!postText.trim() && !mediaFile) {
      alert('Broadcast content or media cannot be empty.');
      return;
    }

    setUploading(true);

    try {
      let mediaUrl = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop()?.toLowerCase() || 'bin';
        const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
        const filePath = `post-media/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, mediaFile, {
            upsert: false,
            contentType: mediaFile.type,
          });

        if (uploadError) {
          throw new Error(`Media upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);

        mediaUrl = urlData?.publicUrl || null;
      }

      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          caption: postText.trim() || null,
          post_type: composerType,
          media_url: mediaUrl,
          media_type: mediaUrl ? mediaType : null,
        });

      if (postError) {
        throw new Error(`Could not publish broadcast: ${postError.message}`);
      }

      await Promise.all([
        fetchPosts(),
        fetchUserProfile(),
        fetchActivities(),
      ]);

      setPostText('');
      clearMediaPreview();

      alert('Broadcast successfully published & +1 Rep earned!');
    } catch (error) {
      console.error('BMAX broadcast error:', error);
      alert(error?.message || 'An unexpected error occurred while publishing.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePost = async (postId) => {
    if (!editText.trim()) {
      alert('Post content cannot be empty.');
      return;
    }

    const { error } = await supabase
      .from('posts')
      .update({ caption: editText.trim() })
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      alert('Failed to edit broadcast: ' + error.message);
      return;
    }

    setEditingPostId(null);
    setEditText('');
    fetchPosts();
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      alert('Failed to delete broadcast: ' + error.message);
      return;
    }

    fetchPosts();
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthMessageType('error');
    }
  };

  const handleOpenUserProfile = async (profile) => {
    if (!profile) return;
    setSelectedProfile(profile);

    if (user?.id) {
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
        .maybeSingle();

      setIsFollowingSelected(!!data);
    }
  };

  const handleToggleFollow = async (targetUserId) => {
    if (!user?.id) {
      alert('Please sign in to follow creators.');
      return;
    }

    if (isFollowingSelected) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);
      setIsFollowingSelected(false);
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId });
      setIsFollowingSelected(true);
    }

    fetchFollowCounts();
  };

  const handleCreateCommunity = (e) => {
    e.preventDefault();
    if (!communityName.trim()) return alert('Please enter a community name.');
    const newComm = {
      id: Date.now(),
      name: communityName,
      desc: communityDesc || 'A newly created builder community.',
      members: 1,
      tag: communityTag
    };
    setCommunities([newComm, ...communities]);
    setCommunityName('');
    setCommunityDesc('');
    alert(`Community "${newComm.name}" created successfully!`);
  };

  const handleLike = async (postId) => {
    if (!user?.id) {
      alert('Please log in to react.');
      return;
    }

    const isLiked = userLikes.includes(postId);

    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
      setUserLikes(prev => prev.filter(id => id !== postId));
    } else {
      await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
      setUserLikes(prev => [...prev, postId]);
    }

    await Promise.all([fetchPosts(), fetchUserProfile(), fetchActivities()]);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthMessage('Enter your email and password.');
      setAuthMessageType('error');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error) {
      setAuthMessage(error.message);
      setAuthMessageType('error');
      return;
    }

    setAuthMessage('Signed in successfully.');
    setAuthMessageType('success');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthMessage('Enter an email and password to create an account.');
      setAuthMessageType('error');
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });

    if (error) {
      setAuthMessage(error.message);
      setAuthMessageType('error');
      return;
    }

    if (data?.user && data?.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: cleanEmail.split('@')[0],
        reputation: 0,
      }, { onConflict: 'id' });

      setUsername(cleanEmail.split('@')[0]);
      setBio('');
      setReputation(0);
    }

    setAuthMessage(
      data?.session
        ? 'Account created and signed in.'
        : 'Account created. Check your email if confirmation is required.'
    );
    setAuthMessageType('success');
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setChatHistory(prev => [...prev, { sender: 'me', text: chatInput, time: 'Just now' }]);
    setChatInput('');
  };

  const filteredPosts = posts.filter(post => {
    if (discoverSearch.trim() === '') return true;
    return post.caption?.toLowerCase().includes(discoverSearch.toLowerCase());
  });

  return (
    <div style={styles.appWrapper}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #030008; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .desktop-only { display: flex; }
        .mobile-only { display: none; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .responsive-grid { grid-template-columns: 1fr !important; }
          .community-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <h1 style={styles.logo}>BMAX</h1>
          <span style={styles.badge}>GLOBAL v2.6</span>
        </div>
        <nav style={styles.topNav} className="desktop-only">
          {['home', 'discover', 'create', 'messages', 'profile'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? styles.activeNavBtn : styles.navBtn}
            >
              {tab === 'home' && '⚡ Feed'}
              {tab === 'discover' && '🧭 Discover'}
              {tab === 'create' && '➕ Hubs'}
              {tab === 'messages' && '💬 Messages'}
              {tab === 'profile' && '👤 Profile'}
            </button>
          ))}
        </nav>
      </header>

      {/* MAIN VIEW */}
      <div style={styles.layoutContainer} className="responsive-grid">
        {activeTab === 'discover' ? (
          <main style={{ gridColumn: '1 / -1', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <div style={styles.card}>
              <h2 style={{ margin: '0 0 10px 0', color: '#c084fc', fontSize: '20px' }}>🧭 Global Network Discovery</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
                Explore open broadcasts and community insights from top-tier creators worldwide.
              </p>
              <input
                type="text"
                placeholder="🔍 Search creator broadcasts or keywords..."
                value={discoverSearch}
                onChange={(e) => setDiscoverSearch(e.target.value)}
                style={{ ...styles.input, padding: '12px 16px', fontSize: '14px', marginBottom: '20px' }}
              />
              <div style={styles.streamContainer}>
                {filteredPosts.map((post) => (
                  <div key={post.id} style={styles.postCard}>
                    <div style={styles.postHeader}>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => handleOpenUserProfile(post.profiles)}
                      >
                        {post.profiles?.avatar_url ? (
                          <img src={post.profiles.avatar_url} alt="Avatar" style={styles.feedAvatarImg} />
                        ) : (
                          <div style={styles.feedAvatar}>👤</div>
                        )}
                        <span style={styles.username}>@{post.profiles?.username || 'builder'}</span>
                      </div>
                      <span style={styles.postType}>{post.post_type}</span>
                    </div>
                    <p style={styles.postContent}>{post.caption}</p>
                    {post.media_url && (
                      <div style={{ marginBottom: '14px' }}>
                        {post.media_type === 'image' ? (
                          <img src={post.media_url} alt="Media" style={styles.postMedia} />
                        ) : (
                          <video src={post.media_url} controls style={styles.postMedia} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </main>
        ) : activeTab === 'create' ? (
          <main style={{ gridColumn: '1 / -1', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
            <div style={styles.card}>
              <h2 style={{ margin: '0 0 8px 0', color: '#c084fc', fontSize: '20px' }}>🌐 Builder Ecosystem Creator</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
                Launch dedicated collaborative hubs and lead high-impact technical communities.
              </p>
              <form onSubmit={handleCreateCommunity} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                <input
                  type="text"
                  placeholder="Community Name (e.g. Next.js Masters)"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  style={{ ...styles.input, padding: '12px' }}
                />
                <textarea
                  placeholder="Describe your community mission..."
                  value={communityDesc}
                  onChange={(e) => setCommunityDesc(e.target.value)}
                  style={{ ...styles.textArea, minHeight: '80px' }}
                />
                <div style={styles.formActionRow}>
                  <select
                    value={communityTag}
                    onChange={(e) => setCommunityTag(e.target.value)}
                    style={{ ...styles.input, width: '160px', padding: '10px' }}
                  >
                    <option value="Tech">Tech & Code</option>
                    <option value="AI">AI & ML</option>
                    <option value="Design">UI/UX Design</option>
                  </select>
                  <button type="submit" style={styles.primaryBtn}>🚀 Launch Hub</button>
                </div>
              </form>
              <h3 style={{ fontSize: '16px', color: '#f8fafc', margin: '20px 0 12px 0' }}>Featured Communities</h3>
              <div style={styles.communityGrid} className="community-grid">
                {communities.map(comm => (
                  <div key={comm.id} style={styles.miniCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#e879f9' }}>{comm.name}</strong>
                      <span style={styles.tagBadge}>{comm.tag}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0' }}>{comm.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#fbbf24' }}>👥 {comm.members} Members</small>
                      <button onClick={() => alert(`Joined ${comm.name}!`)} style={styles.secondaryBtn}>Join</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        ) : activeTab === 'profile' ? (
          <main style={{ gridColumn: '1 / -1', maxWidth: '700px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={styles.card}>
              <div style={styles.profileHeader}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={styles.avatarImg} />
                ) : (
                  <div style={styles.avatar}>👤</div>
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>@{username || user?.email || 'builder'}</h2>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 12px 0' }}>{bio || 'No bio configured yet.'}</p>
                  <div style={styles.profileStatsRow}>
                    <div><strong>{followersCount}</strong> <small style={{ color: '#64748b' }}>Followers</small></div>
                    <div><strong>{followingCount}</strong> <small style={{ color: '#64748b' }}>Following</small></div>
                    <div><strong style={{ color: '#fbbf24' }}>🛡️ {reputation}</strong> <small style={{ color: '#64748b' }}>Reputation PTS</small></div>
                  </div>
                </div>
              </div>
              <div style={styles.profileActions}>
                <button onClick={() => setIsEditingProfile(!isEditingProfile)} style={styles.primaryBtn}>
                  {isEditingProfile ? 'Close Edit' : 'Edit Profile'}
                </button>
              </div>
              {isEditingProfile && (
                <div style={styles.editSection}>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                  />
                  <textarea
                    placeholder="Bio"
                    maxLength={200}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{ ...styles.textArea, minHeight: '60px' }}
                  />
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    Profile Photo (500x500 recommended, auto-cropped to fit profile logo):
                    <input type="file" accept="image/*" onChange={handleAvatarSelect} style={styles.input} />
                  </label>
                  {cropPreview && (
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <p style={{ fontSize: '12px', color: '#c084fc', margin: '0 0 6px 0' }}>Crop Preview (500x500):</p>
                      <img src={cropPreview} alt="Crop preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7e22ce' }} />
                    </div>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <button onClick={handleSaveProfile} style={{ ...styles.primaryBtn, marginTop: '8px' }}>Save Profile</button>
                </div>
              )}
            </div>

            {/* BROADCAST COMPOSER */}
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 12px 0', color: '#c084fc', fontSize: '16px' }}>📡 Broadcast New Post</h3>
              <div style={styles.composerTabs}>
                {['update', 'code block', 'poll'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setComposerType(type)}
                    style={composerType === type ? styles.activeChip : styles.chip}
                  >
                    {type === 'update' ? '📌 Update' : type === 'code block' ? '‹/› Code Block' : '📊 Poll'}
                  </button>
                ))}
              </div>
              <form onSubmit={handleCreatePost} style={styles.composerForm}>
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Share a project update, technical insight, or milestone..."
                  maxLength={5000}
                  style={styles.textArea}
                />
                {mediaPreview && (
                  <div style={styles.previewContainer}>
                    {mediaType === 'image' ? (
                      <img src={mediaPreview} alt="Preview" style={styles.mediaPreview} />
                    ) : (
                      <video src={mediaPreview} controls style={styles.mediaPreview} />
                    )}
                    <button type="button" onClick={clearMediaPreview} style={styles.removeMediaBtn}>✕</button>
                  </div>
                )}
                <div style={styles.composerFooter}>
                  <label style={styles.iconBtn}>
                    📷 Attach Media (Max 1-min video)
                    <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} style={{ display: 'none' }} />
                  </label>
                  <button type="submit" disabled={uploading} style={{ ...styles.broadcastBtn, opacity: uploading ? 0.65 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                    {uploading ? 'Publishing...' : '📡 Broadcast (+1 Rep)'}
                  </button>
                </div>
              </form>
            </div>
          </main>
        ) : activeTab === 'messages' ? (
          <main style={{ gridColumn: '1 / -1', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div style={styles.card}>
              <div style={styles.subTabHeader}>
                <button onClick={() => setMsgSubTab('activity')} style={msgSubTab === 'activity' ? styles.activeSubTab : styles.subTab}>
                  🔔 Reputation & Activity Ledger
                </button>
                <button onClick={() => setMsgSubTab('dms')} style={msgSubTab === 'dms' ? styles.activeSubTab : styles.subTab}>
                  💬 Direct Messages
                </button>
              </div>
              {msgSubTab === 'activity' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activities.length === 0 ? (
                    <div style={styles.activityCard}>
                      <div>No reputation activity recorded yet.</div>
                      <small style={{ color: '#64748b' }}>Publish a broadcast to earn your first point.</small>
                    </div>
                  ) : (
                    activities.map(act => (
                      <div key={act.id} style={styles.activityCard}>
                        <div>{act.text}</div>
                        <small style={{ color: '#64748b' }}>{act.time}</small>
                      </div>
                    ))
                  )}
                </div>
              ) : activeChat ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                  <button onClick={() => setActiveChat(null)} style={{ ...styles.actionBtn, marginBottom: '8px' }}>← Back</button>
                  <h4 style={{ margin: '0 0 12px 0', color: '#fbbf24' }}>Chat with @{activeChat}</h4>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} style={{ alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'me' ? '#7e22ce' : '#1e1b4b', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%' }}>
                        <p style={{ margin: 0, fontSize: '13px' }}>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input type="text" placeholder="Write message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                    <button onClick={handleSendMessage} style={styles.primaryBtn}>Send</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {conversations.map(conv => (
                    <div key={conv.id} onClick={() => setActiveChat(conv.user)} style={styles.conversationCard}>
                      <div>
                        <strong>@{conv.user}</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{conv.lastMsg}</p>
                      </div>
                      {conv.unread && <span style={styles.unreadBadge}>New</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : (
          /* HOME FEED */
          <>
            <main style={styles.feedColumn}>
              <div style={styles.filterRow}>
                {['for you', 'following', 'trending', 'code & tech', 'ai labs', 'design'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFeedFilter(filter)}
                    style={feedFilter === filter ? styles.activeFilterChip : styles.filterChip}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div style={styles.streamContainer}>
                {posts.length === 0 ? (
                  <div style={{ ...styles.card, textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <p style={{ fontSize: '15px', color: '#94a3b8' }}>No global broadcasts found yet.</p>
                    <p style={{ fontSize: '13px' }}>Switch to your <strong>Profile tab</strong> to publish the first network update!</p>
                  </div>
                ) : (
                  posts.map((post) => {
                    const isLiked = userLikes.includes(post.id);
                    const isOwner = user?.id && post.user_id === user.id;
                    const comments = commentsMap[post.id] || [];
                    const isCommentsOpen = activeCommentsPostId === post.id;

                    return (
                      <div key={post.id} style={styles.postCard}>
                        <div style={styles.postHeader}>
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            onClick={() => handleOpenUserProfile(post.profiles)}
                          >
                            {post.profiles?.avatar_url ? (
                              <img src={post.profiles.avatar_url} alt="Avatar" style={styles.feedAvatarImg} />
                            ) : (
                              <div style={styles.feedAvatar}>👤</div>
                            )}
                            <span style={styles.username}>@{post.profiles?.username || 'builder'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={styles.postType}>{post.post_type}</span>
                            {isOwner && (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditingPostId(post.id);
                                    setEditText(post.caption || '');
                                  }} 
                                  style={{ ...styles.actionBtn, color: '#fbbf24' }}
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  onClick={() => handleDeletePost(post.id)} 
                                  style={{ ...styles.actionBtn, color: '#f87171' }}
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingPostId === post.id ? (
                          <div style={{ marginBottom: '14px' }}>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              style={{ ...styles.textArea, minHeight: '70px', marginBottom: '8px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleUpdatePost(post.id)} style={styles.primaryBtn}>Save Edit</button>
                              <button onClick={() => setEditingPostId(null)} style={styles.secondaryBtn}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p style={styles.postContent}>{post.caption}</p>
                        )}

                        {post.media_url && (
                          <div style={styles.mediaWrapper}>
                            {post.media_type === 'image' ? (
                              <img src={post.media_url} alt="Post content" style={styles.postMedia} />
                            ) : (
                              <video src={post.media_url} controls style={styles.postMedia} />
                            )}
                          </div>
                        )}

                        <div style={styles.postActions}>
                          <button onClick={() => handleLike(post.id)} style={styles.actionBtn}>
                            {isLiked ? '❤️ Liked' : '🤍 Like'}
                          </button>
                          <button 
                            onClick={() => {
                              if (isCommentsOpen) {
                                setActiveCommentsPostId(null);
                              } else {
                                setActiveCommentsPostId(post.id);
                                fetchComments(post.id);
                              }
                            }} 
                            style={styles.actionBtn}
                          >
                            💬 Comments ({comments.length})
                          </button>
                          <button style={styles.actionBtn}>🔄 Remix</button>
                        </div>

                        {/* COMMENTS SECTION */}
                        {isCommentsOpen && (
                          <div style={styles.commentSection}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#c084fc' }}>Discussion Comments</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                              {comments.length === 0 ? (
                                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>No comments yet. Be the first to start the conversation!</p>
                              ) : (
                                comments.map((comment) => (
                                  <div key={comment.id} style={styles.commentBox}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                      <strong style={{ fontSize: '12px', color: '#fbbf24' }}>
                                        @{comment.profile?.username || 'builder'}
                                      </strong>
                                      <small style={{ fontSize: '10px', color: '#64748b' }}>
                                        {formatRelativeTime(comment.created_at)}
                                      </small>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc' }}>{comment.content}</p>
                                  </div>
                                ))
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Write a comment..."
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                style={{ ...styles.input, flex: 1, padding: '8px 12px' }}
                              />
                              <button onClick={() => handleAddComment(post.id)} style={styles.primaryBtn}>
                                Comment
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </main>

            <aside style={styles.sidebarColumn}>
              <div style={styles.card}>
                <div style={styles.repHeader}>
                  <span style={styles.repTitle}>🛡️ Reputation Ledger</span>
                  <span style={styles.repValue}>{reputation} PTS</span>
                </div>
                <p style={styles.subtext}>New accounts start at 0 PTS. Accumulate points steadily through verified broadcasts and engagement.</p>
              </div>

              {!user ? (
                <div style={styles.card}>
                  <h3 style={styles.sidebarTitle}>Join BMAX Global</h3>
                  {authMessage && (
                    <div style={authMessageType === 'error' ? styles.errorBox : styles.successBox}>
                      {authMessage}
                    </div>
                  )}

                  <button 
                    onClick={handleGoogleSignIn} 
                    style={{ ...styles.primaryBtn, backgroundColor: '#4285F4', width: '100%', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    🌐 Continue with Google
                  </button>

                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>or sign in with email</div>

                  <form style={styles.authForm}>
                    <input
                      type="email"
                      placeholder="Email address"
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button type="button" onClick={handleSignIn} style={styles.primaryBtn}>Sign In</button>
                      <button type="button" onClick={handleSignUp} style={styles.secondaryBtn}>Sign Up (0 Rep)</button>
                    </div>
                  </form>
                </div>
              ) : (
                <div style={styles.card}>
                  <h3 style={styles.sidebarTitle}>Active Session</h3>
                  <p style={{ color: '#fbbf24', fontWeight: 'bold', margin: '0 0 4px 0' }}>@{username || user.email}</p>
                  <small style={{ color: '#94a3b8' }}>Reputation Score: <strong>{reputation} PTS</strong> (Verified Ledger)</small>
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      {/* BROADCASTER PROFILE MODAL */}
      {selectedProfile && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedProfile(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.profileHeader}>
              {selectedProfile.avatar_url ? (
                <img src={selectedProfile.avatar_url} alt="Avatar" style={styles.avatarImg} />
              ) : (
                <div style={styles.avatar}>👤</div>
              )}
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc' }}>@{selectedProfile.username || 'builder'}</h3>
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#94a3b8' }}>{selectedProfile.bio || 'No bio provided.'}</p>
                <div style={{ color: '#fbbf24', fontSize: '13px', marginTop: '6px' }}>
                  🛡️ {selectedProfile.reputation || 0} Reputation PTS
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              {user?.id !== selectedProfile.id && (
                <button 
                  onClick={() => handleToggleFollow(selectedProfile.id)} 
                  style={isFollowingSelected ? styles.secondaryBtn : styles.primaryBtn}
                >
                  {isFollowingSelected ? 'Following' : 'Follow Broadcaster'}
                </button>
              )}
              <button onClick={() => setSelectedProfile(null)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav style={styles.mobileNav} className="mobile-only">
        {['home', 'discover', 'create', 'messages', 'profile'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? styles.activeMobileBtn : styles.mobileBtn}
          >
            {tab === 'home' && '⚡'}
            {tab === 'discover' && '🧭'}
            {tab === 'create' && '➕'}
            {tab === 'messages' && '💬'}
            {tab === 'profile' && '👤'}
          </button>
        ))}
      </nav>
    </div>
  );
}

const styles = {
  appWrapper: { backgroundColor: '#030008', color: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', backgroundColor: '#090514', borderBottom: '1px solid #1e1b4b', position: 'sticky', top: 0, zIndex: 100 },
  brandGroup: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '2px', color: '#c084fc' },
  badge: { backgroundColor: '#581c87', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', color: '#f8fafc', fontWeight: 'bold' },
  topNav: { display: 'flex', gap: '6px' },
  navBtn: { backgroundColor: 'transparent', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  activeNavBtn: { backgroundColor: '#1e1b4b', border: '1px solid #7e22ce', color: '#fbbf24', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  layoutContainer: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', width: '100%' },
  feedColumn: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' },
  sidebarColumn: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' },
  card: { backgroundColor: '#090514', border: '1px solid #1e1b4b', borderRadius: '16px', padding: '20px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' },
  postCard: { backgroundColor: '#090514', border: '1px solid #1e1b4b', borderRadius: '16px', padding: '20px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' },
  miniCard: { backgroundColor: '#06030d', border: '1px solid #1e1b4b', borderRadius: '12px', padding: '16px' },
  repHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  repTitle: { fontWeight: 'bold', color: '#f8fafc', fontSize: '15px' },
  repValue: { fontWeight: '900', color: '#fbbf24', fontSize: '16px' },
  subtext: { margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' },
  composerTabs: { display: 'flex', gap: '8px', marginBottom: '14px' },
  chip: { backgroundColor: '#120b24', color: '#94a3b8', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer' },
  activeChip: { backgroundColor: '#7e22ce', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' },
  composerForm: { display: 'flex', flexDirection: 'column', gap: '12px' },
  textArea: { backgroundColor: '#030008', border: '1px solid #1e1b4b', borderRadius: '10px', color: '#fff', padding: '14px', minHeight: '90px', resize: 'vertical', fontFamily: 'inherit', width: '100%', fontSize: '14px' },
  previewContainer: { position: 'relative', width: '100%', maxHeight: '280px', overflow: 'hidden', borderRadius: '10px', backgroundColor: '#000' },
  mediaPreview: { width: '100%', height: '100%', objectFit: 'contain' },
  removeMediaBtn: { position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' },
  composerFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { backgroundColor: '#120b24', border: '1px solid #1e1b4b', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', color: '#e879f9', fontSize: '13px', fontWeight: 'bold' },
  broadcastBtn: { backgroundColor: '#7e22ce', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  filterRow: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' },
  filterChip: { backgroundColor: '#090514', color: '#94a3b8', border: '1px solid #1e1b4b', padding: '8px 16px', borderRadius: '14px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' },
  activeFilterChip: { backgroundColor: '#1e1b4b', color: '#fbbf24', border: '1px solid #fbbf24', padding: '8px 16px', borderRadius: '14px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', textTransform: 'capitalize' },
  streamContainer: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' },
  postHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  feedAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1e1b4b', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px' },
  feedAvatarImg: { width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' },
  username: { color: '#c084fc', fontWeight: 'bold', fontSize: '14px' },
  postType: { fontSize: '10px', backgroundColor: '#120b24', border: '1px solid #1e1b4b', padding: '3px 8px', borderRadius: '6px', color: '#e879f9', textTransform: 'uppercase', fontWeight: 'bold' },
  postContent: { margin: '0 0 14px 0', lineHeight: '1.5', wordBreak: 'break-word', fontSize: '15px' },
  mediaWrapper: { borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '14px', border: '1px solid #1e1b4b' },
  postMedia: { width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' },
  postActions: { display: 'flex', gap: '20px', borderTop: '1px solid #1e1b4b', paddingTop: '12px' },
  actionBtn: { backgroundColor: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  commentSection: { marginTop: '14px', borderTop: '1px solid #1e1b4b', paddingTop: '12px' },
  commentBox: { backgroundColor: '#030008', border: '1px solid #1e1b4b', padding: '8px 12px', borderRadius: '8px' },
  sidebarTitle: { margin: '0 0 12px 0', fontSize: '15px', color: '#f8fafc' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { backgroundColor: '#030008', border: '1px solid #1e1b4b', color: '#fff', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', width: '100%' },
  primaryBtn: { backgroundColor: '#7e22ce', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  secondaryBtn: { backgroundColor: '#120b24', border: '1px solid #1e1b4b', color: '#fff', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  errorBox: { backgroundColor: '#450a0a', color: '#fecaca', padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' },
  successBox: { backgroundColor: '#052e16', color: '#bbf7d0', padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' },
  profileHeader: { display: 'flex', gap: '20px', alignItems: 'center' },
  avatar: { width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#1e1b4b', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '28px' },
  avatarImg: { width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover' },
  profileStatsRow: { display: 'flex', gap: '20px', fontSize: '14px' },
  profileActions: { display: 'flex', gap: '8px', marginTop: '16px' },
  editSection: { marginTop: '16px', borderTop: '1px solid #1e1b4b', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  modalBackdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { backgroundColor: '#090514', border: '1px solid #1e1b4b', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '450px' },
  mobileNav: { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#090514', borderTop: '1px solid #1e1b4b', justifyContent: 'space-around', padding: '12px 0', zIndex: 100 },
  mobileBtn: { backgroundColor: 'transparent', border: 'none', fontSize: '22px', padding: '4px' },
  activeMobileBtn: { backgroundColor: '#1e1b4b', border: '1px solid #7e22ce', fontSize: '22px', borderRadius: '10px', padding: '4px' },
  formActionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  communityGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  tagBadge: { fontSize: '10px', backgroundColor: '#3b0764', color: '#f0abfc', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' },
  subTabHeader: { display: 'flex', gap: '12px', borderBottom: '1px solid #1e1b4b', paddingBottom: '10px', marginBottom: '14px' },
  subTab: { backgroundColor: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  activeSubTab: { backgroundColor: 'transparent', border: 'none', color: '#fbbf24', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  activityCard: { backgroundColor: '#030008', border: '1px solid #1e1b4b', padding: '12px', borderRadius: '8px', fontSize: '13px' },
  conversationCard: { backgroundColor: '#030008', border: '1px solid #1e1b4b', padding: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  unreadBadge: { backgroundColor: '#7e22ce', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }
};
