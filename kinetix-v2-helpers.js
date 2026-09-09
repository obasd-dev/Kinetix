import { supabase } from '@/lib/supabaseClient';

// --- Multi-Feed Fetching ---
export async function fetchKinetixFeed(feedType = 'For You', city = null) {
  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (id, username, avatar_url, reputation_score),
      parent_post:parent_post_id (*, profiles:user_id (username))
    `)
    .order('created_at', { ascending: false });

  if (feedType === 'Local' && city) {
    query = query.eq('location_city', city);
  } else if (feedType !== 'For You' && feedType !== 'Trending') {
    query = query.eq('feed_category', feedType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// --- Native Post Reshare / Remix ---
export async function kinetixResharePost(originalPostId, userId, reshareType = 'reshare', customContent = '') {
  const { data, error } = await supabase
    .from('posts')
    .insert([{
      user_id: userId,
      content: customContent,
      parent_post_id: originalPostId,
      post_type: reshareType
    }])
    .select()
    .single();

  if (error) throw error;

  // Reward points for re-sharing/remixing platform content
  await supabase.rpc('increment_reputation', { user_id: userId, points: 5 });
  return data;
}

// --- Follow-Gated Persistent Messaging ---
export async function kinetixSendMessage(senderId, recipientId, content, mediaUrl = null) {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert([{
      sender_id: senderId,
      recipient_id: recipientId,
      content,
      media_url: mediaUrl
    }])
    .select();

  if (error) throw error;
  return data;
}

// --- Find People by What They're Building ---
export async function findBuildersByTag(buildingTag) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, current_project_title, build_tags, reputation_score')
    .contains('build_tags', [buildingTag]);

  if (error) throw error;
  return data;
}
