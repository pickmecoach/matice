import MaticeLocalizationConfig from "./MaticeLocalizationConfig"
import { getPluralIndex } from './get_plural_index'

function assert(value: boolean, message: string) {
  if (! value) throw message
}

export interface TranslationOptions {
  args?: { [key: string]: any },
  pluralize?: boolean,
  locale?: string,
}

class Localization {
  private static _instance: Localization

  public static get instance(): Localization {
    if (Localization._instance === undefined) {
      Localization._instance = new Localization()
    }
    return Localization._instance
  }

  private constructor() {
    // @ts-ignore
    MaticeLocalizationConfig.locale = Matice.locale

    // @ts-ignore
    MaticeLocalizationConfig.fallbackLocale = Matice.fallbackLocale

    // @ts-ignore
    MaticeLocalizationConfig.locales = Object.keys(Matice.translations)
  }

  /**
   * Update the locale
   * @param locale
   */
  public setLocale(locale: string) {
    MaticeLocalizationConfig.locale = locale
  }

  /**
   * Retrieve the current locale
   */
  public getLocale() {
    return MaticeLocalizationConfig.locale
  }

  /**
   * Return a listing of the locales.
   */
  public locales() {
    return MaticeLocalizationConfig.locales
  }

  /**
   * Get the translations of [locale].
   * @param locale
   */
  private translations(locale: string = MaticeLocalizationConfig.locale) {
    // Matice is added with the directive "@translation"
    // @ts-ignore
    let translations = Matice.translations

    if (translations === undefined) {
      console.warn('Matice Translation not found. For Matice-js to work, make sure to add @translations' +
        ' blade directive in your view. Usually insert the directive in app.layout.')
      translations = []
    } else {
      translations = translations[locale]

      if (translations === undefined) {
        throw `Locale [${locale}] does not exist.`
      }
    }

    return translations
  }

  /**
   * Translate the given key.
   */
  public trans(key: string, silentNotFoundError: boolean, options: TranslationOptions = {args: {}, pluralize: false}) {
    const args = options.args || {}

    let sentence = this.findSentence(key, silentNotFoundError, options.locale)

    if (options.pluralize) {
      assert(typeof args.count === 'number',
        'On pluralization, the argument `count` must be a number and non-null.')
      sentence = this.pluralize(sentence, args.count)
    }

    // Replace the variables in sentence.
    Object.keys(args).forEach((key) => {
      sentence = sentence.replace(new RegExp(':' + key, 'g'), args[key])
    })

    return sentence
  }


  // noinspection JSMethodCanBeStatic
  /**
   * Manage sentence pluralization the sentence. Return the good sentence depending of the `count` argument.
   */
  private pluralize(sentence: string, count: number): string {
    let parts = sentence.split('|')
    const extracted = this.extract(parts, count);

    if (extracted !== null) {
      return extracted.trim()
    }
  
    parts = this.stripConditions(parts);
    const pluralIndex = getPluralIndex(MaticeLocalizationConfig.locale, count);

    if (parts.length === 1 || !parts[pluralIndex]) {
      return parts[0]
    }
  
    return parts[pluralIndex]
  }

  /**
 * Strip the inline conditions from each segment, just leaving the text.
 */
  private stripConditions(segments: string[]): string[] {
    return segments.map((part) => part.replace(/^[\{\[]([^\[\]\{\}]*)[\}\]]/, ''))
  }

  /**
   * Extract a translation string using inline conditions.
   */
  private extract(segments: string[], number: number): string | null {
    for (const part of segments) {
      let line = this.extractFromString(part, number)

      if (line !== null) {
        return line
      }
    }

    return null
  }

  /**
   * Get the translation string if the condition matches.
   */
  private extractFromString(part: string, number: number): string | null {
    const matches = part.match(/^[\{\[]([^\[\]\{\}]*)[\}\]](.*)/s) || []
    if (matches.length !== 3) {
      return null
    }

    const condition = matches[1]
    const value = matches[2]

    if (condition.includes(',')) {
      let [from, to] = condition.split(',')

      if (to === '*' && number >= parseFloat(from)) {
        return value
      } else if (from === '*' && number <= parseFloat(to)) {
        return value
      } else if (number >= parseFloat(from) && number <= parseFloat(to)) {
        return value
      }
    }

    return parseFloat(condition) === number ? value : null
  }

  /**
   * Find the sentence using associated with the [key].
   * @param key
   * @param silentNotFoundError
   * @param locale
   * @param splitKey
   * @returns {string}
   * @private
   */
  private findSentence(key: string, silentNotFoundError: boolean, locale: string = MaticeLocalizationConfig.locale, splitKey: boolean = false): string {
    const translations: { [key: string]: any } = this.translations(locale)

    // At first [link] is a [Map<String, dynamic>] but at the end, it can be a [String],
    // the sentences.
    let link = translations

    const parts = splitKey ? key.split('.') : [key]

    for (const part of parts) {
      // Get the new json until we fall on the last key of
      // the array which should point to a String.
      if (typeof link === 'object' && part in link) {
        // Make sure the key exist.
        link = link[part]
      } else {
        // If key not found, try to split it using dot.
        if (!splitKey) {
          return this.findSentence(key, silentNotFoundError, locale, true)
        }

        // If key not found, try with the fallback locale.
        if (locale !== MaticeLocalizationConfig.fallbackLocale) {
          return this.findSentence(key, silentNotFoundError, MaticeLocalizationConfig.fallbackLocale)
        }

        // If the key not found and the silent mode is on, return the key,
        if (silentNotFoundError) return key

        // If key not found and the silent mode is off, throw error,
        throw `Translation key not found : "${key}" -> Exactly "${part}" not found`
      }
    }

    return link.toString()
  }
}



/*
|
| ----------------------------------
| Exports
| ----------------------------------
|
*/


/**
 * Translate the given message.
 * @param key
 * @param options
 */
export function trans(key: string, options: TranslationOptions = {args: {}, pluralize: false}) {
  return Localization.instance.trans(key, false, options)
}

/**
 * Translate the given message with the particularity to return the key if
 * the sentence was not found, instead of throwing an exception.
 * @param key
 * @param options
 */
export function __(key: string, options: TranslationOptions = {args: {}, pluralize: false}) {
  return Localization.instance.trans(key, true, options)
}

/**
 * An helper to the trans function but with the pluralization mode activated by default.
 * @param key
 * @param count
 * @param args
 * @param locale
 */
export function transChoice(key: string, count: number, args: {} = {}, locale: string = MaticeLocalizationConfig.locale) {
  return trans(key, { args: {...args, count}, pluralize: true, locale })
}

/**
 * Update the locale
 * @param locale
 */
export function setLocale(locale: string) {
  Localization.instance.setLocale(locale)

}

/**
 * Retrieve the current locale
 */
export function getLocale() {
  return Localization.instance.getLocale()
}

/**
 * Return a listing of the locales.
 */
export function locales() {
  return Localization.instance.locales()
}
