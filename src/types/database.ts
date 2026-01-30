export type NarrativeSource = 'author' | 'character' | 'inconspicuous' | 'polyphonic';
export type NarrativeStructure = 'linear' | 'retrospective' | 'flashforward' | 'circular' | 'parallel' | 'episodic';
export type NarrativePurpose = 'informational' | 'evaluative' | 'artistic' | 'instructive' | 'identificational';
export type NarrativePlot = 'overcoming_monster' | 'rags_to_riches' | 'quest' | 'comedy' | 'tragedy' | 'resurrection' | 'forbidden' | 'mystery';
export type NarrativeSpecial = 'conspiratorial' | 'transmedia' | 'personal' | 'corporate' | 'escapist' | 'propaganda';
export type StoryStatus = 'draft' | 'scheduled' | 'published';
export type PartCategory = 'story' | 'just_business';

export type LLMProvider = 'lovable' | 'openai' | 'gemini' | 'geminiV22' | 'anthropic' | 'zai' | 'mistral';

export interface Settings {
  id: string;
  auto_generation_enabled: boolean;
  generation_interval_hours: number;
  last_auto_generation: string | null;
  narrative_source: NarrativeSource;
  narrative_structure: NarrativeStructure;
  narrative_purpose: NarrativePurpose;
  narrative_plot: NarrativePlot;
  narrative_special: NarrativeSpecial;
  bradbury_weight: number;
  clarke_weight: number;
  gaiman_weight: number;
  // LLM settings
  llm_provider: LLMProvider;
  llm_text_provider: LLMProvider;
  llm_image_provider: LLMProvider;
  llm_text_model: string;
  llm_image_model: string;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  gemini_v22_api_key: string | null;
  anthropic_api_key: string | null;
  zai_api_key: string | null;
  mistral_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export const LLM_MODELS = {
  lovable: {
    text: [
      { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (швидкий)' },
      { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview (потужний)' },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'openai/gpt-5', label: 'GPT-5 (найпотужніший)' },
      { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'openai/gpt-5.2', label: 'GPT-5.2 (новітній)' },
    ],
    image: [
      { value: 'google/gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (новітній)' },
      { value: 'google/gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image' },
    ]
  },
  openai: {
    text: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    image: [
      { value: 'dall-e-3', label: 'DALL-E 3' },
      { value: 'dall-e-2', label: 'DALL-E 2' },
    ]
  },
  gemini: {
    text: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    image: [
      { value: 'imagen-3', label: 'Imagen 3' },
    ]
  },
  geminiV22: {
    text: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (V22)' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (V22)' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (V22)' },
    ],
    image: [
      { value: 'imagen-3', label: 'Imagen 3' },
    ]
  },
  anthropic: {
    text: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
    image: []
  },
  zai: {
    text: [
      { value: 'GLM-4.7', label: 'GLM-4.7 (найпотужніший)' },
      { value: 'GLM-4.7-Flash', label: 'GLM-4.7-Flash (швидкий)' },
      { value: 'GLM-4.5-Air', label: 'GLM-4.5-Air (легкий)' },
    ],
    image: []
  },
  mistral: {
    text: [
      { value: 'mistral-large-latest', label: 'Mistral Large (найпотужніший)' },
      { value: 'mistral-medium-latest', label: 'Mistral Medium' },
      { value: 'mistral-small-latest', label: 'Mistral Small (швидкий)' },
      { value: 'codestral-latest', label: 'Codestral (код)' },
    ],
    image: []
  }
};

export interface Volume {
  id: string;
  number: number;
  title: string;
  description: string | null;
  year: number;
  month: number;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  volume_id: string;
  number: number;
  title: string;
  title_en: string | null;
  title_pl: string | null;
  description: string | null;
  description_en: string | null;
  description_pl: string | null;
  week_of_month: number;
  narrator_monologue: string | null;
  narrator_monologue_en: string | null;
  narrator_monologue_pl: string | null;
  narrator_commentary: string | null;
  narrator_commentary_en: string | null;
  narrator_commentary_pl: string | null;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  cover_image_url_2: string | null;
  cover_image_prompt_2: string | null;
  cover_image_url_3: string | null;
  cover_image_prompt_3: string | null;
  chat_dialogue: ChatMessage[] | unknown;
  tweets: Tweet[] | unknown;
  created_at: string;
  updated_at: string;
}

export interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
}

export interface ChatMessage {
  id?: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes?: number;
  characterLikes?: CharacterLike[];
  replyTo?: string; // ID of the message being replied to
  threadId?: string; // ID of the thread root message
}

export interface Tweet {
  author: string;
  handle: string;
  content: string;
  likes: number;
  retweets: number;
}

export interface Part {
  id: string;
  chapter_id: string;
  number: number;
  title: string;
  title_en: string | null;
  title_pl: string | null;
  content: string;
  content_en: string | null;
  content_pl: string | null;
  content_html: string | null;
  date: string;
  status: StoryStatus;
  scheduled_at: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  cover_image_url_2: string | null;
  cover_image_prompt_2: string | null;
  cover_image_type: string | null;
  news_sources: Array<{ url: string; title: string; image_url?: string; is_selected?: boolean }> | unknown;
  chat_dialogue: ChatMessage[] | unknown;
  tweets: Tweet[] | unknown;
  narrative_source: NarrativeSource | null;
  narrative_structure: NarrativeStructure | null;
  narrative_purpose: NarrativePurpose | null;
  narrative_plot: NarrativePlot | null;
  narrative_special: NarrativeSpecial | null;
  is_flash_news: boolean;
  category?: string | null;
  manual_images?: unknown;
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  part_id: string | null;
  external_id: string | null;
  source_name: string | null;
  source_url: string | null;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  category: string | null;
  fetched_at: string;
  used_in_generation: boolean;
}

export interface Generation {
  id: string;
  part_id: string | null;
  type: 'story' | 'image' | 'summary';
  prompt: string | null;
  result: string | null;
  model_used: string | null;
  news_used: unknown;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AdminStats {
  volumes: number;
  chapters: number;
  parts: number;
  publishedParts: number;
  generations: number;
}

export const NARRATIVE_OPTIONS = {
  source: {
    author: { label: 'Авторський', description: 'Автор виступає як всезнаючий оповідач' },
    character: { label: 'Персонажний', description: 'Історію подає Наратор від першої особи' },
    inconspicuous: { label: 'Непримітний', description: 'Без явного оповідача, лише події' },
    polyphonic: { label: 'Поліфонічний', description: 'Кілька рівноправних голосів' }
  },
  structure: {
    linear: { label: 'Лінійний', description: 'Події йдуть послідовно' },
    retrospective: { label: 'Ретроспектива', description: 'Повернення в минуле' },
    flashforward: { label: 'Флешфорвард', description: 'Стрибок у майбутнє' },
    circular: { label: 'Кільцевий', description: 'Початок і кінець збігаються' },
    parallel: { label: 'Паралельний', description: 'Кілька сюжетних ліній' },
    episodic: { label: 'Епізодичний', description: 'Серія пов\'язаних історій' }
  },
  purpose: {
    informational: { label: 'Інформаційний', description: 'Передача фактів' },
    evaluative: { label: 'Оціночний', description: 'Вплив на думку' },
    artistic: { label: 'Художній', description: 'Викликати емоції' },
    instructive: { label: 'Інструктивний', description: 'Навчити' },
    identificational: { label: 'Ідентифікаційний', description: 'Формування спільноти' }
  },
  plot: {
    overcoming_monster: { label: 'Подолання монстра', description: 'Герой перемагає загрозу' },
    rags_to_riches: { label: 'З бідності до багатства', description: 'Історія успіху' },
    quest: { label: 'Мандрівка', description: 'Подорож і повернення' },
    comedy: { label: 'Комедія', description: 'Хаос веде до щастя' },
    tragedy: { label: 'Трагедія', description: 'Падіння героя' },
    resurrection: { label: 'Воскресіння', description: 'Спокутування' },
    forbidden: { label: 'Заборона', description: 'Порушення з наслідками' },
    mystery: { label: 'Загадка', description: 'Розкриття таємниці' }
  },
  special: {
    conspiratorial: { label: 'Конспірологічний', description: 'Таємна змова' },
    transmedia: { label: 'Трансмедійний', description: 'Через різні медіа' },
    personal: { label: 'Особистий', description: 'Автобіографічний' },
    corporate: { label: 'Корпоративний', description: 'Історія бренду' },
    escapist: { label: 'Ескапістський', description: 'Відволікання від реальності' },
    propaganda: { label: 'Пропагандистський', description: 'Формування думки' }
  }
};
