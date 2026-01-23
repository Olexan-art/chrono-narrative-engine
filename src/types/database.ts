export type NarrativeSource = 'author' | 'character' | 'inconspicuous' | 'polyphonic';
export type NarrativeStructure = 'linear' | 'retrospective' | 'flashforward' | 'circular' | 'parallel' | 'episodic';
export type NarrativePurpose = 'informational' | 'evaluative' | 'artistic' | 'instructive' | 'identificational';
export type NarrativePlot = 'overcoming_monster' | 'rags_to_riches' | 'quest' | 'comedy' | 'tragedy' | 'resurrection' | 'forbidden' | 'mystery';
export type NarrativeSpecial = 'conspiratorial' | 'transmedia' | 'personal' | 'corporate' | 'escapist' | 'propaganda';
export type StoryStatus = 'draft' | 'scheduled' | 'published';

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
  created_at: string;
  updated_at: string;
}

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
  description: string | null;
  week_of_month: number;
  narrator_monologue: string | null;
  narrator_commentary: string | null;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: string;
  chapter_id: string;
  number: number;
  title: string;
  content: string;
  content_html: string | null;
  date: string;
  status: StoryStatus;
  scheduled_at: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  cover_image_prompt: string | null;
  news_sources: Array<{ url: string; title: string }>;
  narrative_source: NarrativeSource | null;
  narrative_structure: NarrativeStructure | null;
  narrative_purpose: NarrativePurpose | null;
  narrative_plot: NarrativePlot | null;
  narrative_special: NarrativeSpecial | null;
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
