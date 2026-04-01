/**
 * Return the plural form of the noun.
 * @param count the quantity/amount of the word.
 * @param noun the singular form of the entity in question
 * @param pluralForm the plural form if different than noun+'s'
 * @param suffix 's'
 * @returns singular or plural form of the word depending on quantity.
 */
export const pluralize = (count: number, noun: string, pluralForm?: string, suffix = 's') => `${count !== 1 ? pluralForm || noun + suffix : noun}`
