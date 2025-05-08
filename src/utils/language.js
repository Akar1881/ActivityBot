const fs = require('fs');
const path = require('path');

// Cache for language files
const languageCache = {};

// Default language
const defaultLanguage = 'en';

// Automatically detect available languages from the languages directory
function detectAvailableLanguages() {
  const languagesDir = path.join(__dirname, '..', 'languages');
  const availableLanguages = {};

  try {
    // Get all JSON files in the languages directory
    const files = fs.readdirSync(languagesDir).filter(file => file.endsWith('.json'));
    
    // Process each language file
    files.forEach(file => {
      try {
        const langCode = file.replace('.json', '');
        const filePath = path.join(languagesDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const translations = JSON.parse(fileContent);
        
        // Use the languageName property from the JSON file or fallback to the language code
        if (translations.languageName) {
          availableLanguages[langCode] = translations.languageName;
        } else {
          availableLanguages[langCode] = langCode;
          console.warn(`Warning: Language file ${file} does not contain a 'languageName' property.`);
        }
      } catch (err) {
        console.error(`Error processing language file ${file}:`, err);
      }
    });

    // Ensure default language exists
    if (!availableLanguages[defaultLanguage]) {
      console.warn(`Warning: Default language '${defaultLanguage}' not found in language files.`);
    }
    
    return availableLanguages;
  } catch (error) {
    console.error('Error detecting available languages:', error);
    // Fallback to just English if there's an error
    return { en: 'English' };
  }
}

// Available languages (automatically detected)
const availableLanguages = detectAvailableLanguages();

/**
 * Load a language file
 * @param {string} lang - Language code
 * @returns {object} - Language translations
 */
function loadLanguage(lang) {
  if (languageCache[lang]) {
    return languageCache[lang];
  }

  try {
    const filePath = path.join(__dirname, '..', 'languages', `${lang}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const translations = JSON.parse(fileContent);
    languageCache[lang] = translations;
    return translations;
  } catch (error) {
    console.error(`Error loading language file for ${lang}:`, error);
    // Fallback to default language
    if (lang !== defaultLanguage) {
      return loadLanguage(defaultLanguage);
    }
    return {};
  }
}

/**
 * Get translation for a key
 * @param {string} key - Translation key (dot notation)
 * @param {string} lang - Language code
 * @returns {string} - Translated text
 */
function translate(key, lang = defaultLanguage) {
  const translations = loadLanguage(lang);
  
  // Handle dot notation (e.g., "header.home")
  const keys = key.split('.');
  let result = translations;
  
  for (const k of keys) {
    if (result && result[k]) {
      result = result[k];
    } else {
      // Key not found, fallback to default language
      if (lang !== defaultLanguage) {
        return translate(key, defaultLanguage);
      }
      return key; // Last resort fallback
    }
  }
  
  return result;
}

module.exports = {
  translate,
  availableLanguages,
  defaultLanguage
};