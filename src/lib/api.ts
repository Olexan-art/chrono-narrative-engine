const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export async function callEdgeFunction<T>(
  functionName: string, 
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({ error: 'Failed to parse response' }));

  if (!response.ok) {
    console.error(`Edge function ${functionName} error:`, response.status, data);
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export async function fetchNews(date?: string) {
  return callEdgeFunction<{
    success: boolean;
    articles: Array<{
      external_id: string;
      source_name: string;
      source_url: string;
      title: string;
      description: string;
      content: string;
      url: string;
      image_url: string;
      published_at: string;
      category: string;
    }>;
    date: string;
    count: number;
  }>('fetch-news', { date });
}

export async function generateStory(params: {
  news: Array<{ title: string; description: string; source_name: string; url: string }>;
  date: string;
  narrativeSource?: string;
  narrativeStructure?: string;
  narrativePurpose?: string;
  narrativePlot?: string;
  narrativeSpecial?: string;
  bradburyWeight?: number;
  clarkeWeight?: number;
  gaimanWeight?: number;
}) {
  return callEdgeFunction<{
    success: boolean;
    story: {
      title: string;
      title_en?: string;
      title_pl?: string;
      content: string;
      content_en?: string;
      content_pl?: string;
      imagePrompt: string;
      imagePrompt2?: string;
      chatDialogue?: Array<{
        character: string;
        name: string;
        avatar: string;
        message: string;
      }>;
      chatDialogue_en?: Array<{
        character: string;
        name: string;
        avatar: string;
        message: string;
      }>;
      chatDialogue_pl?: Array<{
        character: string;
        name: string;
        avatar: string;
        message: string;
      }>;
      tweets?: Array<{
        author: string;
        handle: string;
        content: string;
        likes: number;
        retweets: number;
      }>;
      tweets_en?: Array<{
        author: string;
        handle: string;
        content: string;
        likes: number;
        retweets: number;
      }>;
      tweets_pl?: Array<{
        author: string;
        handle: string;
        content: string;
        likes: number;
        retweets: number;
      }>;
    };
  }>('generate-story', params);
}

export async function generateImage(prompt: string, partId?: string, imageIndex: number = 1) {
  return callEdgeFunction<{
    success: boolean;
    imageUrl: string;
    imageIndex: number;
  }>('generate-image', { prompt, partId, imageIndex });
}

export async function adminAction<T>(
  action: string, 
  password: string, 
  data?: Record<string, unknown>
): Promise<T> {
  return callEdgeFunction<T>('admin', { action, password, data });
}

export async function translateContent(params: {
  partId?: string;
  chapterId?: string;
  volumeId?: string;
  targetLanguage: 'en' | 'pl';
}) {
  return callEdgeFunction<{
    success: boolean;
    translated: Record<string, string>;
  }>('translate', params);
}

interface DialogueResult {
  id: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes: number;
  characterLikes: Array<{
    characterId: string;
    name: string;
    avatar: string;
  }>;
  replyTo?: string;
  threadId?: string;
}

interface TweetResult {
  author: string;
  handle: string;
  content: string;
  likes: number;
  retweets: number;
}

export async function generateDialogue(params: {
  storyContext: string;
  newsContext: string;
  narrativeSource?: string;
  narrativeStructure?: string;
  useOpenAI?: boolean;
  messageCount?: number;
  characters?: string;
  enableThreading?: boolean;
  threadProbability?: number;
  chapterId?: string;
  generateTweets?: boolean;
  tweetCount?: number;
}) {
  return callEdgeFunction<{
    success: boolean;
    dialogue: DialogueResult[];
    dialogue_en?: DialogueResult[];
    dialogue_pl?: DialogueResult[];
    tweets?: TweetResult[];
    tweets_en?: TweetResult[];
    tweets_pl?: TweetResult[];
    thirdCharacterIncluded: boolean;
  }>('generate-dialogue', params);
}
