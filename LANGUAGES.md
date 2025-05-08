# Languages

ActivityBot's dashboard supports multiple languages through a flexible translation system. The system automatically detects and loads all language files from the `src/languages` directory.

## Supported Languages

Currently, the following languages are supported:

| Language | Code | File | Contributor |
|----------|------|------|-------------|
| English | `en` | [en.json](src/languages/en.json) | Core Team |
| Kurdish (Sorani) | `ku` | [ku.json](src/languages/ku.json) | Core Team |

## Adding a New Language

You can easily add support for a new language by following these steps:

1. Create a new JSON file in the `src/languages` directory with the language code as the filename (e.g., `es.json` for Spanish)
2. Include the `languageName` property at the top of the file to specify how the language should be displayed in the language selector
3. Copy the structure from an existing language file (like `en.json`) and translate all values

### Example Language File Structure

```json
{
  "languageName": "Español",
  "header": {
    "home": "Inicio",
    "leaderboard": "Clasificación",
    "dashboard": "Panel de control",
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión"
  },
  // ... other translations
}
```

## Translation Keys

The translation system uses dot notation to access nested properties. For example, `header.home` refers to the "home" property inside the "header" object.

Main sections include:

- `header`: Navigation and user interface elements in the header
- `home`: Text on the home/landing page
- `dashboard`: Dashboard-related text
- `leaderboard`: Leaderboard page text
- `guildSettings`: Server settings page text
- `footer`: Footer text

## Fallback Mechanism

If a translation is missing for a key, the system will automatically fall back to the default language (English). This ensures that even partially translated languages will work correctly.

## Contributing Translations

We welcome contributions for new languages or improvements to existing translations! If you'd like to contribute:

1. Fork the repository
2. Add or update the language file
3. Submit a pull request

Please ensure your translations are accurate and maintain the same meaning as the original text.

## Language Detection

The system automatically detects the user's preferred language based on:

1. The `lang` query parameter in the URL (e.g., `?lang=fr`)
2. The language cookie if previously set
3. Falling back to the default language (English)

Users can change their language at any time using the language dropdown in the header.# Languages

ActivityBot's dashboard supports multiple languages through a flexible translation system. The system automatically detects and loads all language files from the `src/languages` directory.

## Supported Languages

Currently, the following languages are supported:

| Language | Code | File | Contributor |
|----------|------|------|-------------|
| English | `en` | [en.json](src/languages/en.json) | Core Team |
| Kurdish (Sorani) | `ku` | [ku.json](src/languages/ku.json) | Core Team |
| French | `fr` | [fr.json](src/languages/fr.json) | Core Team |
| German | `de` | [de.json](src/languages/de.json) | Core Team |
| Arabic | `ar` | [ar.json](src/languages/ar.json) | Core Team |

## Adding a New Language

You can easily add support for a new language by following these steps:

1. Create a new JSON file in the `src/languages` directory with the language code as the filename (e.g., `es.json` for Spanish)
2. Include the `languageName` property at the top of the file to specify how the language should be displayed in the language selector
3. Copy the structure from an existing language file (like `en.json`) and translate all values

### Example Language File Structure

```json
{
  "languageName": "Español",
  "header": {
    "home": "Inicio",
    "leaderboard": "Clasificación",
    "dashboard": "Panel de control",
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión"
  },
  // ... other translations
}
```

## Translation Keys

The translation system uses dot notation to access nested properties. For example, `header.home` refers to the "home" property inside the "header" object.

Main sections include:

- `header`: Navigation and user interface elements in the header
- `home`: Text on the home/landing page
- `dashboard`: Dashboard-related text
- `leaderboard`: Leaderboard page text
- `guildSettings`: Server settings page text
- `footer`: Footer text

## Fallback Mechanism

If a translation is missing for a key, the system will automatically fall back to the default language (English). This ensures that even partially translated languages will work correctly.

## Contributing Translations

We welcome contributions for new languages or improvements to existing translations! If you'd like to contribute:

1. Fork the repository
2. Add or update the language file
3. Submit a pull request

Please ensure your translations are accurate and maintain the same meaning as the original text.

## Language Detection

The system automatically detects the user's preferred language based on:

1. The `lang` query parameter in the URL (e.g., `?lang=fr`)
2. The language cookie if previously set
3. Falling back to the default language (English)

Users can change their language at any time using the language dropdown in the header.
