/**
 * Configuration for country-specific content field identifiers
 * Each country has its own "retold" and "dialogue" field identifiers
 */

export interface CountryContentConfig {
  code: string;
  // Field name(s) for retold/retell content
  retoldFields: string[];
  // Minimum length to consider content as "retold" (longer = processed content)
  retoldMinLength: number;
  // Field name for dialogue content (all use chat_dialogue JSONB)
  dialogueField: string;
}

/**
 * Country-specific content field configuration
 * Maps country codes to their respective content field identifiers
 */
export const COUNTRY_CONTENT_CONFIG: Record<string, CountryContentConfig> = {
  // USA - retold content stored in content_en
  US: {
    code: 'US',
    retoldFields: ['content_en'],
    retoldMinLength: 300,
    dialogueField: 'chat_dialogue',
  },

  // Poland - retold content stored in native content field

  // Ukraine - retold content stored in native content field
  UA: {
    code: 'UA',
    retoldFields: ['content'],
    retoldMinLength: 500,
    dialogueField: 'chat_dialogue',
  },

  // India - retold content stored in Indian language fields

  // United Kingdom - retold content stored in content_en (same as US)
  GB: {
    code: 'GB',
    retoldFields: ['content_en'],
    retoldMinLength: 300,
    dialogueField: 'chat_dialogue',
  },
};

/**
 * Default configuration for unknown countries
 */
export const DEFAULT_CONTENT_CONFIG: CountryContentConfig = {
  code: 'DEFAULT',
  retoldFields: ['content_en'],
  retoldMinLength: 300,
  dialogueField: 'chat_dialogue',
};

/**
 * Get content configuration for a specific country code
 */
export function getCountryConfig(countryCode: string): CountryContentConfig {
  return COUNTRY_CONTENT_CONFIG[countryCode] || DEFAULT_CONTENT_CONFIG;
}

/**
 * Check if a news item is "retold" based on country configuration
 */
export function isNewsRetold(
  item: Record<string, unknown>,
  countryCode: string
): boolean {
  const config = getCountryConfig(countryCode);

  for (const field of config.retoldFields) {
    const value = item[field];
    if (
      value &&
      typeof value === 'string' &&
      value.trim().length >= config.retoldMinLength
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a news item has dialogue based on country configuration
 */
export function hasNewsDialogue(item: Record<string, unknown>): boolean {
  const dialogue = item['chat_dialogue'];

  if (!dialogue) return false;

  // Check if it's a non-empty array
  if (Array.isArray(dialogue) && dialogue.length > 0) {
    return true;
  }

  // Check if it's a non-empty object
  if (typeof dialogue === 'object' && Object.keys(dialogue).length > 0) {
    return true;
  }

  return false;
}

/**
 * Get statistics labels for display
 */
export function getStatsLabels(countryCode: string): { retoldLabel: string; dialogueLabel: string } {
  const config = getCountryConfig(countryCode);

  const fieldLabels: Record<string, string> = {
    content_en: 'EN',
    content: 'Native',
    content_hi: 'HI',
    content_ta: 'TA',
    content_te: 'TE',
    content_bn: 'BN',
  };

  const retoldLabel = config.retoldFields
    .map(f => fieldLabels[f] || f)
    .join('/');

  return {
    retoldLabel: `Переказано (${retoldLabel})`,
    dialogueLabel: 'Діалоги',
  };
}
